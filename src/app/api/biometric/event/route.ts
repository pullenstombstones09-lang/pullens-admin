// HikVision Access Control Terminal — event listener.
// Receives push notifications from each enrolled device and writes them
// into biometric_events + derives attendance rows.
//
// Auth: HTTP Basic, credentials configured on the device's "Listening Host" page.
// Set BIOMETRIC_WEBHOOK_USER and BIOMETRIC_WEBHOOK_PASSWORD on the server.
//
// Device IDs: configured at runtime via the BIOMETRIC_DEVICE_MAP env var, a
// JSON map of MAC address → site/device_id. Example:
//   {"88:de:39:3f:d1:6d":"allandale","aa:bb:cc:dd:ee:ff":"durban"}
// Unknown MACs default to device_id="unknown_<mac>" so we still capture the
// event without blowing up.

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { deriveAttendance, isoToLocalDate, type BiometricEventLike } from '@/lib/biometric-derive';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

function checkAuth(req: NextRequest): boolean {
  const expectedUser = process.env.BIOMETRIC_WEBHOOK_USER;
  const expectedPass = process.env.BIOMETRIC_WEBHOOK_PASSWORD;
  if (!expectedUser || !expectedPass) return false;
  const header = req.headers.get('authorization') || '';
  if (!header.startsWith('Basic ')) return false;
  try {
    const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
    const [user, ...rest] = decoded.split(':');
    const pass = rest.join(':');
    return user === expectedUser && pass === expectedPass;
  } catch {
    return false;
  }
}

function getDeviceId(mac: string | undefined): string {
  if (!mac) return 'unknown_no_mac';
  const normalised = mac.toLowerCase().replace(/-/g, ':');
  try {
    const map = JSON.parse(process.env.BIOMETRIC_DEVICE_MAP || '{}') as Record<string, string>;
    const normalisedMap: Record<string, string> = {};
    for (const [k, v] of Object.entries(map)) normalisedMap[k.toLowerCase().replace(/-/g, ':')] = v;
    return normalisedMap[normalised] || `unknown_${normalised}`;
  } catch {
    return `unknown_${normalised}`;
  }
}

interface AccessControllerEvent {
  deviceName?: string;
  majorEventType?: number;
  subEventType?: number;
  name?: string;
  employeeNoString?: string;
  serialNo?: number;
  attendanceStatus?: string;
  pictureURL?: string;
}

interface HikEventPayload {
  ipAddress?: string;
  macAddress?: string;
  dateTime?: string;
  eventType?: string;
  AccessControllerEvent?: AccessControllerEvent;
}

export async function POST(request: NextRequest) {
  if (!checkAuth(request)) {
    return new Response('Unauthorized', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="biometric"' },
    });
  }

  let body: HikEventPayload;
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    // Some HikVision firmware versions push events as multipart with a JSON
    // part named "event_log" and an optional face JPEG part. Pull the JSON.
    const form = await request.formData();
    const jsonPart = form.get('event_log') || form.get('AccessControllerEvent') || form.get('json');
    if (!jsonPart) {
      return Response.json({ ok: true, ignored: 'no_json_part' });
    }
    try {
      body = JSON.parse(typeof jsonPart === 'string' ? jsonPart : await (jsonPart as File).text());
    } catch {
      return Response.json({ ok: true, ignored: 'bad_json' }, { status: 200 });
    }
  } else {
    try {
      body = await request.json();
    } catch {
      return Response.json({ ok: true, ignored: 'not_json' }, { status: 200 });
    }
  }

  // Filter: only act on AccessController face-match events (major=5, sub=75).
  // Everything else (door open/close, heartbeats, etc.) we ACK and ignore.
  const ace = body.AccessControllerEvent;
  if (!ace || ace.majorEventType !== 5 || ace.subEventType !== 75) {
    return Response.json({ ok: true, ignored: 'non_face_event', eventType: body.eventType });
  }
  if (!ace.employeeNoString || ace.serialNo === undefined) {
    return Response.json({ ok: true, ignored: 'missing_employee_or_serial' });
  }

  const deviceId = getDeviceId(body.macAddress);
  const eventTime = body.dateTime || new Date().toISOString();
  const eventDate = isoToLocalDate(eventTime);
  const biometricId = ace.employeeNoString;

  const supabase = getSupabase();

  // 1) Look up the employee by biometric_id (NULL if unknown — we still log)
  const { data: employee } = await supabase
    .from('employees')
    .select('id, pt_code, full_name')
    .eq('biometric_id', biometricId)
    .maybeSingle();

  // 2) Insert the raw event. UNIQUE (device_id, device_serial) → dedup on retry.
  const { error: insertError } = await supabase.from('biometric_events').insert({
    device_id: deviceId,
    device_serial: ace.serialNo,
    employee_id: employee?.id ?? null,
    biometric_id: biometricId,
    raw_name: ace.name ?? null,
    event_time: eventTime,
    event_date: eventDate,
    event_type: ace.attendanceStatus ?? 'unknown',
    picture_url: ace.pictureURL ?? null,
    raw_payload: body as unknown as object,
  });

  if (insertError) {
    // Most likely a duplicate (device retried). Treat as idempotent success.
    if (insertError.code === '23505') {
      return Response.json({ ok: true, deduplicated: true });
    }
    console.error('biometric_events insert error:', insertError);
    return Response.json({ error: insertError.message }, { status: 500 });
  }

  // 3) If we couldn't resolve the employee, log and stop — no attendance row to derive.
  if (!employee) {
    return Response.json({
      ok: true,
      stored: true,
      warning: `Unknown biometric_id ${biometricId} — event logged but no employee match`,
    });
  }

  // 4) Re-derive attendance for (employee, event_date).
  const { data: dayEvents } = await supabase
    .from('biometric_events')
    .select('event_time')
    .eq('employee_id', employee.id)
    .eq('event_date', eventDate);

  const derivation = deriveAttendance((dayEvents ?? []) as BiometricEventLike[]);

  // 5) Upsert attendance — but DON'T clobber a manual override.
  // If an attendance row already exists with time_in_source='manual', leave
  // time_in alone; same for time_out. Only fill in fields that are still null
  // and sourced from biometric, or are new.
  const { data: existing } = await supabase
    .from('attendance')
    .select('id, status, time_in, time_out, time_in_source, time_out_source')
    .eq('employee_id', employee.id)
    .eq('date', eventDate)
    .maybeSingle();

  const next = {
    employee_id: employee.id,
    date: eventDate,
    status: existing?.status || 'present',
    time_in: existing?.time_in_source === 'manual' ? existing.time_in : derivation.time_in,
    time_out: existing?.time_out_source === 'manual' ? existing.time_out : derivation.time_out,
    time_in_source:
      existing?.time_in_source === 'manual'
        ? 'manual'
        : derivation.time_in_source ?? existing?.time_in_source ?? 'manual',
    time_out_source:
      existing?.time_out_source === 'manual'
        ? 'manual'
        : derivation.time_out_source ?? existing?.time_out_source ?? 'manual',
    late_minutes: existing && 'late_minutes' in existing ? undefined : 0,
  };

  const { error: upsertError } = await supabase
    .from('attendance')
    .upsert(next, { onConflict: 'employee_id,date' });

  if (upsertError) {
    console.error('attendance upsert error:', upsertError);
    return Response.json({ error: upsertError.message, partial: true }, { status: 500 });
  }

  // Mark the event as processed
  await supabase
    .from('biometric_events')
    .update({ processed_at: new Date().toISOString() })
    .eq('device_id', deviceId)
    .eq('device_serial', ace.serialNo);

  return Response.json({
    ok: true,
    pt_code: employee.pt_code,
    full_name: employee.full_name,
    date: eventDate,
    time_in: next.time_in,
    time_out: next.time_out,
    event_count: derivation.event_count,
  });
}

// Hik devices test the listener with a GET sometimes; reply 200 so it shows
// "online" in the device's listening-host config UI.
export async function GET() {
  return Response.json({ ok: true, listener: 'pullens-biometric-event', version: 1 });
}

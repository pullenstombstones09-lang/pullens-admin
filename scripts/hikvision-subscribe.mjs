#!/usr/bin/env node
// HikVision DS-K1T343MWX — subscribe device to push events to our webhook.
//
// Usage (PowerShell, .env.local values are read automatically):
//   node scripts/hikvision-subscribe.mjs                  # configure listening host
//   node scripts/hikvision-subscribe.mjs --status         # show current config
//   node scripts/hikvision-subscribe.mjs --test           # trigger a test post
//   node scripts/hikvision-subscribe.mjs --url=http://...  # override target URL
//
// What it does:
//   1) PUT /ISAPI/Event/notification/httpHosts/1
//      Tells the device: "push events to <our URL> using Basic auth <user>:<pw>"
//   2) POST /ISAPI/Event/notification/subscribeEvent
//      Says: "I want AccessControllerEvent notifications"
//
// Reads env: HIKVISION_HOST / USER / PW, BIOMETRIC_WEBHOOK_USER / PASSWORD,
// and BIOMETRIC_WEBHOOK_URL (or builds one from VERCEL_URL).

import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';

// --- env loader (so we don't need dotenv) -----------------------------------
function loadEnv() {
  try {
    const txt = fs.readFileSync('.env.local', 'utf8');
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {}
}
loadEnv();

const args = process.argv.slice(2);
const status = args.includes('--status');
const test = args.includes('--test');
const urlOverride = args.find((a) => a.startsWith('--url='))?.slice(6);

const HIK_HOST = process.env.HIKVISION_HOST || '192.168.8.11';
const HIK_USER = process.env.HIKVISION_USER;
const HIK_PW = process.env.HIKVISION_PW;
const WEBHOOK_URL = urlOverride
  || process.env.BIOMETRIC_WEBHOOK_URL
  || 'https://pullens-admin.vercel.app/api/biometric/event';
const WEBHOOK_USER = process.env.BIOMETRIC_WEBHOOK_USER || 'pullens_bio';
const WEBHOOK_PW = process.env.BIOMETRIC_WEBHOOK_PASSWORD;

if (!HIK_USER || !HIK_PW) {
  console.error('Missing HIKVISION_USER / HIKVISION_PW in .env.local');
  process.exit(1);
}
if (!status && !WEBHOOK_PW) {
  console.error('Missing BIOMETRIC_WEBHOOK_PASSWORD in .env.local');
  process.exit(1);
}

// --- HTTP Digest auth helper -----------------------------------------------
function md5(s) {
  return crypto.createHash('md5').update(s).digest('hex');
}

function parseDigest(header) {
  const parts = {};
  header.replace(/^Digest /, '').split(',').forEach((p) => {
    const m = p.trim().match(/^(\w+)="?([^"]*)"?$/);
    if (m) parts[m[1]] = m[2];
  });
  return parts;
}

function rawReq({ path, method, headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const r = http.request(
      { host: HIK_HOST, port: 80, path, method, headers, timeout: 10000 },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () =>
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks).toString(),
          })
        );
      }
    );
    r.on('error', reject);
    r.on('timeout', () => r.destroy(new Error('timeout (device unreachable)')));
    if (body) r.write(body);
    r.end();
  });
}

async function digest(method, path, jsonBody = null) {
  const bodyStr = jsonBody ? JSON.stringify(jsonBody) : null;
  const baseHeaders = bodyStr
    ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }
    : {};

  const first = await rawReq({ path, method, headers: baseHeaders, body: bodyStr });
  if (first.status !== 401) return first;

  const wa = first.headers['www-authenticate'];
  if (!wa) throw new Error('No 401 challenge');
  const d = parseDigest(wa);

  const nc = '00000001';
  const cnonce = crypto.randomBytes(8).toString('hex');
  const qop = (d.qop || 'auth').split(',')[0].trim();
  const ha1 = md5(`${HIK_USER}:${d.realm}:${HIK_PW}`);
  const ha2 = md5(`${method}:${path}`);
  const response = md5(`${ha1}:${d.nonce}:${nc}:${cnonce}:${qop}:${ha2}`);
  const authParts = [
    `username="${HIK_USER}"`, `realm="${d.realm}"`, `nonce="${d.nonce}"`,
    `uri="${path}"`, `qop=${qop}`, `nc=${nc}`, `cnonce="${cnonce}"`,
    `response="${response}"`, `algorithm=MD5`,
  ];
  if (d.opaque) authParts.push(`opaque="${d.opaque}"`);

  return rawReq({
    path,
    method,
    body: bodyStr,
    headers: { ...baseHeaders, Authorization: `Digest ${authParts.join(', ')}` },
  });
}

// --- Actions ----------------------------------------------------------------
async function showStatus() {
  console.log(`Reading current listening host config from ${HIK_HOST}...`);
  const res = await digest('GET', '/ISAPI/Event/notification/httpHosts?format=json');
  console.log(`Status ${res.status}`);
  console.log(res.body);
}

async function subscribe() {
  const url = new URL(WEBHOOK_URL);
  const protocol = url.protocol === 'https:' ? 'HTTPS' : 'HTTP';
  const port = url.port ? Number(url.port) : (protocol === 'HTTPS' ? 443 : 80);

  const cfg = {
    HttpHostNotification: {
      id: '1',
      url: url.pathname + url.search,
      protocolType: protocol,
      parameterFormatType: 'JSON',
      addressingFormatType: 'hostname',
      hostName: url.hostname,
      portNo: port,
      httpAuthenticationMethod: 'MD5digest',  // Hik uses 'MD5digest' for Basic-like; falls back internally
      userName: WEBHOOK_USER,
      password: WEBHOOK_PW,
    },
  };

  console.log(`Configuring device → ${WEBHOOK_URL}`);
  console.log(`Basic auth user: ${WEBHOOK_USER}`);

  // Try MD5digest first; if device refuses, fall back to 'none' (not great but works)
  let res = await digest('PUT', '/ISAPI/Event/notification/httpHosts/1?format=json', cfg);
  console.log(`PUT httpHosts/1 → ${res.status}`);
  if (res.status >= 400) {
    console.log('Body:', res.body.slice(0, 600));
    console.log('Retrying with httpAuthenticationMethod=none...');
    cfg.HttpHostNotification.httpAuthenticationMethod = 'none';
    res = await digest('PUT', '/ISAPI/Event/notification/httpHosts/1?format=json', cfg);
    console.log(`Retry → ${res.status}`);
    console.log('Body:', res.body.slice(0, 600));
  } else {
    console.log('Body:', res.body.slice(0, 400));
  }

  // Subscribe to AccessControllerEvent
  console.log('\nSubscribing to AccessControllerEvent...');
  const sub = await digest('POST', '/ISAPI/Event/notification/subscribeEvent?format=json', {
    SubscribeEvent: {
      eventMode: 'list',
      EventList: [{ type: 'AccessControllerEvent', minorAlarm: '', minorException: '', minorOperation: '', minorEvent: '' }],
    },
  });
  console.log(`subscribeEvent → ${sub.status}`);
  console.log('Body:', sub.body.slice(0, 400));
}

async function fireTest() {
  console.log('Triggering test notification...');
  const res = await digest('POST', '/ISAPI/Event/notification/httpHosts/1/test?format=json');
  console.log(`Status ${res.status}`);
  console.log(res.body);
}

(async () => {
  if (status) await showStatus();
  else if (test) await fireTest();
  else await subscribe();
})().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleSupabase } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

async function getUser() {
  const cookieStore = await cookies();
  const raw = cookieStore.get('pullens-user')?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as { id: string; role: string };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const employeeId = req.nextUrl.searchParams.get('employeeId');
  if (!employeeId) {
    return NextResponse.json({ error: 'Missing employeeId' }, { status: 400 });
  }

  const supabase = await createServiceRoleSupabase();
  const { data: emp } = await supabase
    .from('employees')
    .select('id_document_url')
    .eq('id', employeeId)
    .single();

  if (!emp?.id_document_url) {
    return NextResponse.json({ url: null });
  }

  // Generate a fresh signed URL from the stored path
  const filePath = emp.id_document_url.replace('id-documents/', '');
  const { data: signedData } = await supabase.storage
    .from('id-documents')
    .createSignedUrl(filePath, 3600); // 1 hour

  return NextResponse.json({ url: signedData?.signedUrl || null });
}

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user || !['owner', 'supervisor'].includes(user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const employeeId = formData.get('employeeId') as string | null;

    if (!file || !employeeId) {
      return NextResponse.json({ error: 'Missing file or employeeId' }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Maximum 5MB.' }, { status: 400 });
    }

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Accepted: JPG, PNG, WebP, PDF.' }, { status: 400 });
    }

    const supabase = await createServiceRoleSupabase();
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${employeeId}/id-copy.${ext}`;

    // Ensure bucket exists
    const { data: buckets } = await supabase.storage.listBuckets();
    if (!buckets?.find((b: { name: string }) => b.name === 'id-documents')) {
      await supabase.storage.createBucket('id-documents', { public: false });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from('id-documents')
      .upload(path, buffer, { upsert: true, contentType: file.type });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const storagePath = `id-documents/${path}`;
    const { error: dbError } = await supabase
      .from('employees')
      .update({ id_document_url: storagePath })
      .eq('id', employeeId);

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    const { data: signedData } = await supabase.storage
      .from('id-documents')
      .createSignedUrl(path, 3600);

    return NextResponse.json({
      url: signedData?.signedUrl,
      storagePath,
      contentType: file.type,
    });
  } catch (err) {
    console.error('ID doc upload error:', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getUser();
  if (!user || user.role !== 'owner') {
    return NextResponse.json({ error: 'Only owner can delete ID documents' }, { status: 403 });
  }

  const employeeId = req.nextUrl.searchParams.get('employeeId');
  if (!employeeId) {
    return NextResponse.json({ error: 'Missing employeeId' }, { status: 400 });
  }

  const supabase = await createServiceRoleSupabase();
  const { data: emp } = await supabase
    .from('employees')
    .select('id_document_url')
    .eq('id', employeeId)
    .single();

  if (emp?.id_document_url) {
    const filePath = emp.id_document_url.replace('id-documents/', '');
    await supabase.storage.from('id-documents').remove([filePath]);
  }

  const { error: dbError } = await supabase
    .from('employees')
    .update({ id_document_url: null })
    .eq('id', employeeId);

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use raw supabase-js with service role key for storage operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const employeeId = formData.get('employeeId') as string | null;

    if (!file || !employeeId) {
      return NextResponse.json({ error: 'Missing file or employeeId' }, { status: 400 });
    }

    const ext = file.name.split('.').pop() || 'jpg';
    const path = `employee-photos/${employeeId}.${ext}`;

    // Ensure bucket exists
    const { data: buckets } = await supabase.storage.listBuckets();
    const docsBucket = buckets?.find(b => b.name === 'documents');
    if (!docsBucket) {
      await supabase.storage.createBucket('documents', { public: true });
    }

    // Upload file
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(path, buffer, {
        upsert: true,
        contentType: file.type,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path);
    const photoUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    // Update employee record
    const { error: dbError } = await supabase
      .from('employees')
      .update({ photo_url: photoUrl })
      .eq('id', employeeId);

    if (dbError) {
      console.error('DB update error:', dbError);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json({ photo_url: photoUrl });
  } catch (err) {
    console.error('Upload handler error:', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}

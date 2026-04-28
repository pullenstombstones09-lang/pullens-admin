import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('photo') as File
  const date = formData.get('date') as string

  if (!file || !date) {
    return NextResponse.json({ error: 'Missing photo or date' }, { status: 400 })
  }

  const { createServiceRoleSupabase } = await import('@/lib/supabase/server')
  const supabase = await createServiceRoleSupabase()

  const path = `registers/${date}/photo-${Date.now()}.${file.name.split('.').pop()}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error } = await supabase.storage
    .from('registers')
    .upload(path, buffer, { contentType: file.type, upsert: true })

  if (error) {
    console.error('Photo upload failed:', error.message)
    return NextResponse.json({ error: 'Upload failed — storage not configured yet' }, { status: 500 })
  }

  const { data: { publicUrl } } = supabase.storage.from('registers').getPublicUrl(path)
  return NextResponse.json({ url: publicUrl, path })
}

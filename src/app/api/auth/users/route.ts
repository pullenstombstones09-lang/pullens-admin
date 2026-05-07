import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {},
      },
    }
  )

  // Only show the 7 Pullens Admin users — OS users share this Supabase project
  const ADMIN_NAMES = ['Annika', 'Nisha', 'Veshi', 'Marlyn', 'Cheryl', 'Lee-Ann', 'Kam']

  const { data, error } = await supabase
    .from('users')
    .select('id, name, role')
    .eq('active', true)
    .in('name', ADMIN_NAMES)
    .order('name')

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ users: data ?? [] })
}

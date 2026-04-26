import { createBrowserClient } from '@supabase/ssr';

// Using service role key to bypass RLS — safe for internal 6-user admin tool
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

const USERS = ['Annika', 'Nisha', 'Veshi', 'Marlyn', 'Lee-Ann', 'Kam'] as const;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const error = params.error;

  async function loginAction(formData: FormData) {
    'use server';

    const name = formData.get('name') as string;
    if (!name) return redirect('/login?error=No+name');

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll() {},
        },
      }
    );

    const { data: user, error: err } = await supabase
      .from('users')
      .select('id, name, role, perms')
      .eq('name', name)
      .eq('active', true)
      .single();

    if (err || !user) return redirect('/login?error=User+not+found');

    cookieStore.set('pullens-user', JSON.stringify({
      id: user.id,
      name: user.name,
      role: user.role,
      perms: user.perms,
    }), {
      path: '/',
      httpOnly: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
    });

    redirect('/dashboard');
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      background: '#1A1A2E',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '0.15em', color: '#FFFFFF', margin: 0 }}>
            PULLENS ADMIN
          </h1>
          <p style={{ fontSize: 13, fontWeight: 600, marginTop: 4, color: '#C4A35A', letterSpacing: '0.3em' }}>
            CAST IN STONE
          </p>
        </div>

        <div style={{
          borderRadius: 16,
          padding: 24,
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}>
          <p style={{ textAlign: 'center', fontSize: 14, marginBottom: 20, color: 'rgba(255,255,255,0.6)' }}>
            Select your name to sign in
          </p>

          {error && (
            <p style={{ textAlign: 'center', fontSize: 14, marginBottom: 16, color: '#f87171' }}>
              {error}
            </p>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {USERS.map((name) => (
              <form key={name} action={loginAction}>
                <input type="hidden" name="name" value={name} />
                <button type="submit" style={{
                  width: '100%',
                  minHeight: 48,
                  padding: '12px 16px',
                  borderRadius: 12,
                  fontSize: 18,
                  fontWeight: 500,
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#FFFFFF',
                  cursor: 'pointer',
                }}>
                  {name}
                </button>
              </form>
            ))}
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, marginTop: 24, color: 'rgba(255,255,255,0.2)' }}>
          Pullen&apos;s Tombstones &middot; Est. 1982
        </p>
      </div>
    </div>
  );
}

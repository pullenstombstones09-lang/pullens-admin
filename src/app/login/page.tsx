const USERS = ['Annika', 'Nisha', 'Veshi', 'Marlyn', 'Lee-Ann', 'Kam'] as const;

export default function LoginPage() {
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {USERS.map((name) => (
              <a
                key={name}
                href={`/api/auth/login?name=${name}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 48,
                  padding: '12px 16px',
                  borderRadius: 12,
                  fontSize: 18,
                  fontWeight: 500,
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#FFFFFF',
                  textDecoration: 'none',
                  cursor: 'pointer',
                }}
              >
                {name}
              </a>
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

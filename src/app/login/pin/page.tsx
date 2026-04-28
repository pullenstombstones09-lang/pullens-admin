export default async function PinPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string; error?: string }>;
}) {
  const params = await searchParams;
  const name = params.name || '';
  const error = params.error || '';

  if (!name) {
    return (
      <meta httpEquiv="refresh" content="0;url=/login" />
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 bg-[#1E293B] font-[Inter,system-ui,sans-serif]"
    >
      {/* Radial glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[#1E40AF]/[0.04] blur-[120px]" />
      </div>

      <div className="w-full max-w-[360px] relative z-10">
        {/* Branding */}
        <div className="text-center mb-6">
          <h1 className="text-[24px] font-black tracking-[0.15em] text-white leading-none">
            PULLENS ADMIN
          </h1>
          <p className="text-[12px] font-semibold mt-1 text-[#1E40AF] tracking-[0.3em]">
            CAST IN STONE
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-6 bg-white/[0.05] border border-white/[0.1] shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-sm">
          {/* User name */}
          <div className="text-center mb-5">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#1E40AF]/20 border border-[#1E40AF]/30 mb-3">
              <span className="text-2xl font-black text-[#1E40AF]">
                {name.charAt(0).toUpperCase()}
              </span>
            </div>
            <p className="text-white text-lg font-semibold">{name}</p>
            <p className="text-white/40 text-xs mt-1">Enter your 4-digit PIN</p>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-center">
              <p className="text-red-400 text-sm">{decodeURIComponent(error)}</p>
            </div>
          )}

          {/* Hidden form — POST to /api/auth/login */}
          <form action="/api/auth/login" method="POST" id="pin-form">
            <input type="hidden" name="name" value={name} />
            <input type="hidden" name="pin" id="pin-input" value="" />
          </form>

          {/* PIN dots */}
          <div className="flex justify-center gap-3 mb-6" id="pin-dots">
            <div className="w-3.5 h-3.5 rounded-full bg-white/15 border border-white/20 transition-all duration-150" data-dot="0"></div>
            <div className="w-3.5 h-3.5 rounded-full bg-white/15 border border-white/20 transition-all duration-150" data-dot="1"></div>
            <div className="w-3.5 h-3.5 rounded-full bg-white/15 border border-white/20 transition-all duration-150" data-dot="2"></div>
            <div className="w-3.5 h-3.5 rounded-full bg-white/15 border border-white/20 transition-all duration-150" data-dot="3"></div>
          </div>

          {/* Number pad */}
          <div className="grid grid-cols-3 gap-2.5 mb-4">
            {['1','2','3','4','5','6','7','8','9'].map((digit) => (
              <button
                key={digit}
                type="button"
                data-digit={digit}
                className="min-h-[56px] rounded-xl bg-white/10 hover:bg-white/15 active:bg-white/20 active:scale-95 text-white text-2xl font-semibold transition-all duration-100 select-none"
              >
                {digit}
              </button>
            ))}
            <a
              href="/login"
              className="min-h-[56px] rounded-xl bg-white/5 hover:bg-white/10 text-white/40 text-xs font-semibold uppercase tracking-wider flex items-center justify-center no-underline transition-all duration-100"
            >
              Back
            </a>
            <button
              type="button"
              data-digit="0"
              className="min-h-[56px] rounded-xl bg-white/10 hover:bg-white/15 active:bg-white/20 active:scale-95 text-white text-2xl font-semibold transition-all duration-100 select-none"
            >
              0
            </button>
            <button
              type="button"
              id="backspace-btn"
              className="min-h-[56px] rounded-xl bg-white/5 hover:bg-white/10 active:bg-white/15 text-white/40 transition-all duration-100 flex items-center justify-center select-none"
              aria-label="Backspace"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 4H8l-7 8 7 8h13a2 2 0 002-2V6a2 2 0 00-2-2z" />
                <line x1="18" y1="9" x2="12" y2="15" />
                <line x1="12" y1="9" x2="18" y2="15" />
              </svg>
            </button>
          </div>
        </div>

        <p className="text-center text-xs mt-6 text-white/20">
          Pullen&apos;s Tombstones &middot; Est. 1982
        </p>
      </div>

      {/* Inline script — no React, no hydration */}
      <script dangerouslySetInnerHTML={{ __html: `
        (function() {
          var pin = '';
          var input = document.getElementById('pin-input');
          var form = document.getElementById('pin-form');
          var dots = document.querySelectorAll('[data-dot]');
          var buttons = document.querySelectorAll('[data-digit]');
          var backspace = document.getElementById('backspace-btn');

          function updateDots() {
            dots.forEach(function(dot, i) {
              if (i < pin.length) {
                dot.style.backgroundColor = '#1E40AF';
                dot.style.borderColor = '#1E40AF';
                dot.style.transform = 'scale(1.15)';
              } else {
                dot.style.backgroundColor = 'rgba(255,255,255,0.15)';
                dot.style.borderColor = 'rgba(255,255,255,0.2)';
                dot.style.transform = 'scale(1)';
              }
            });
          }

          buttons.forEach(function(btn) {
            btn.addEventListener('click', function() {
              if (pin.length < 4) {
                pin += btn.getAttribute('data-digit');
                input.value = pin;
                updateDots();
                if (pin.length === 4) {
                  setTimeout(function() { form.submit(); }, 200);
                }
              }
            });
          });

          backspace.addEventListener('click', function() {
            pin = pin.slice(0, -1);
            input.value = pin;
            updateDots();
          });
        })();
      `}} />
    </div>
  );
}

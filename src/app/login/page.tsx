import Image from 'next/image';

const USERS = ['Annika', 'Nisha', 'Veshi', 'Marlyn', 'Lee-Ann', 'Kam'] as const;

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // Can't await in server component body for Next 16, use sync access pattern
  return <LoginContent />;
}

function LoginContent() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#1E293B] font-[Inter,system-ui,sans-serif]">
      {/* Subtle radial glow behind card */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[#1E40AF]/[0.04] blur-[120px]" />
      </div>

      <div className="w-full max-w-[420px] relative z-10">
        {/* Branding */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="flex justify-center mb-6">
            <Image src="/logo.png" alt="Pullens Tombstones" width={200} height={100} className="object-contain brightness-0 invert" />
          </div>
          <h1 className="text-[28px] font-black tracking-[0.15em] text-white leading-none">
            PULLENS ADMIN
          </h1>
          <p className="text-[13px] font-semibold mt-1.5 text-[#1E40AF] tracking-[0.3em]">
            CAST IN STONE
          </p>
        </div>

        {/* Glass card */}
        <div className="rounded-2xl p-6 bg-white/[0.05] border border-white/[0.1] shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.05)] backdrop-blur-sm animate-slide-in-up">
          <p className="text-center text-sm mb-5 text-white/60">
            Select your name to sign in
          </p>

          <div className="grid grid-cols-2 gap-3">
            {USERS.map((name, i) => (
              <a
                key={name}
                href={`/login/pin?name=${name}`}
                className={`
                  flex items-center justify-center min-h-[48px] px-4 py-3
                  rounded-xl text-lg font-medium
                  bg-white/[0.08] border border-white/[0.08]
                  text-white no-underline cursor-pointer
                  transition-all duration-200 ease-out
                  hover:bg-[#1E40AF]/20 hover:border-[#1E40AF]/30 hover:text-[#1E40AF]
                  hover:shadow-[0_4px_20px_rgba(196,163,90,0.15)]
                  active:scale-[0.97] active:bg-[#1E40AF]/25
                  animate-fade-in-up stagger-${i + 1}
                `}
              >
                {name}
              </a>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs mt-6 text-white/20 animate-fade-in stagger-6">
          Pullen&apos;s Tombstones &middot; Est. 1982
        </p>
      </div>
    </div>
  );
}

'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

interface LoginUser {
  id: string
  name: string
  role: string
}

export default function LoginPage() {
  const [users, setUsers] = useState<LoginUser[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUser, setLastUser] = useState<string | null>(null)

  useEffect(() => {
    setLastUser(localStorage.getItem('pullens-last-user'))

    fetch('/api/auth/users')
      .then(res => res.json())
      .then(data => {
        setUsers(data.users ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#1E293B] font-[Inter,system-ui,sans-serif]">
      <div className="w-full max-w-[420px] relative z-10">
        {/* Branding */}
        <div className="text-center mb-8 animate-[fadeInUp_400ms_ease-out]">
          <div className="flex justify-center mb-6 bg-white/10 backdrop-blur-sm rounded-2xl p-4 mx-auto w-fit">
            <Image src="/logo.png" alt="Pullens Tombstones" width={200} height={100} className="object-contain" />
          </div>
          <h1 className="text-[28px] font-black tracking-[0.15em] text-white leading-none">
            PULLENS ADMIN
          </h1>
          <p className="text-[13px] font-semibold mt-1.5 text-[#C4A35A] tracking-[0.3em]">
            CAST IN STONE
          </p>
        </div>

        {/* Glass card */}
        <div className="rounded-2xl p-6 bg-white/[0.05] border border-white/[0.1] shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-sm animate-[fadeInUp_500ms_ease-out]">
          <p className="text-center text-sm mb-5 text-white/60">
            Select your name to sign in
          </p>

          <div className="grid grid-cols-2 gap-3">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-[48px] rounded-xl bg-white/10" />
              ))
            ) : (
              users.map((user) => (
                <a
                  key={user.id}
                  href={`/login/pin?name=${encodeURIComponent(user.name)}`}
                  onClick={() => localStorage.setItem('pullens-last-user', user.name)}
                  className={cn(
                    'flex items-center justify-center min-h-[48px] px-4 py-3',
                    'rounded-xl text-lg font-medium',
                    'border no-underline cursor-pointer',
                    'transition-all duration-200 ease-out',
                    'active:scale-[0.97]',
                    user.name === lastUser
                      ? 'bg-[#C4A35A]/20 border-[#C4A35A]/40 text-[#C4A35A] ring-1 ring-[#C4A35A]/20'
                      : 'bg-white/[0.08] border-white/[0.08] text-white hover:bg-white/[0.15] hover:border-white/[0.15]'
                  )}
                >
                  {user.name}
                </a>
              ))
            )}
          </div>
        </div>

        <p className="text-center text-xs mt-6 text-white/20">
          Pullen&apos;s Tombstones &middot; Est. 1982
        </p>
      </div>
    </div>
  )
}

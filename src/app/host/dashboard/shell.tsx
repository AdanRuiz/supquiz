'use client'

import { useStaffSession } from '@/lib/use-staff-session'
import { supabase } from '@/types/types'
import type { User } from '@supabase/supabase-js'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createContext, useContext, useEffect, useState } from 'react'
import BrandMark from '../brand-mark'
import Nav from './nav'

const StaffContext = createContext<User | null>(null)

/** The signed-in host. Only available inside the dashboard. */
export const useStaffUser = () => {
  const user = useContext(StaffContext)
  if (!user) throw new Error('useStaffUser must be used inside the dashboard')
  return user
}

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const session = useStaffSession()
  const router = useRouter()
  const [isSigningOut, setIsSigningOut] = useState(false)

  useEffect(() => {
    if (session.status === 'signed-out') {
      router.replace('/host/login')
    }
  }, [session.status, router])

  if (session.status !== 'signed-in') {
    return (
      <div className="min-h-dvh bg-green-50 grid place-items-center">
        <p className="text-green-800 font-medium motion-safe:animate-breathe">
          Checking your session…
        </p>
      </div>
    )
  }

  const signOut = async () => {
    setIsSigningOut(true)
    await supabase.auth.signOut()
    router.replace('/host/login')
  }

  return (
    <StaffContext.Provider value={session.user}>
      <div className="min-h-dvh bg-green-50 text-gray-900 md:flex">
        <aside className="shrink-0 bg-green-950 text-white md:w-60 md:h-dvh md:sticky md:top-0 flex flex-col">
          <div className="flex items-center justify-between gap-4 px-4 md:px-5 h-16">
            <Link
              href="/host/dashboard"
              className="flex items-center gap-2.5 rounded-md font-extrabold text-xl tracking-tight"
            >
              <BrandMark className="w-7 h-7" />
              SupQuiz
            </Link>
            <button
              onClick={signOut}
              disabled={isSigningOut}
              className="md:hidden h-9 px-3 rounded-lg text-sm font-semibold text-green-200 hover:bg-white/5 hover:text-white"
            >
              Sign out
            </button>
          </div>
          <div className="px-3 pb-3 md:pt-2">
            <Nav />
          </div>
          <div className="hidden md:block mt-auto px-3 pb-4">
            <div className="rounded-xl bg-white/5 px-3 py-3">
              <p className="text-xs text-green-300">Signed in as</p>
              <p className="mt-0.5 text-sm font-semibold truncate" title={session.user.email}>
                {session.user.email}
              </p>
              <button
                onClick={signOut}
                disabled={isSigningOut}
                className="mt-3 w-full h-9 rounded-lg bg-white/10 text-sm font-semibold hover:bg-white/15 disabled:opacity-60"
              >
                {isSigningOut ? 'Signing out…' : 'Sign out'}
              </button>
            </div>
          </div>
        </aside>
        <main className="flex-grow min-w-0 px-4 py-6 md:px-10 md:py-10">{children}</main>
      </div>
    </StaffContext.Provider>
  )
}

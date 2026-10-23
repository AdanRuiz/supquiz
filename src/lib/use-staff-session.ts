'use client'

import { supabase } from '@/types/types'
import type { User } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { isStaffUser } from './staff'

export type StaffSessionState =
  | { status: 'loading'; user: null }
  | { status: 'signed-out'; user: null }
  | { status: 'signed-in'; user: User }

const toState = (user: User | null | undefined): StaffSessionState =>
  user && isStaffUser(user)
    ? { status: 'signed-in', user }
    : { status: 'signed-out', user: null }

/** Tracks whether a @tec.mx host is signed in on this browser. */
export function useStaffSession(): StaffSessionState {
  const [state, setState] = useState<StaffSessionState>({ status: 'loading', user: null })

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (active) setState(toState(data.session?.user))
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setState(toState(session?.user))
    })
    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  return state
}

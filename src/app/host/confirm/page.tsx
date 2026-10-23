'use client'

import { isStaffUser, MIN_PASSWORD_LENGTH } from '@/lib/staff'
import { supabase } from '@/types/types'
import type { EmailOtpType } from '@supabase/supabase-js'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useEffect, useRef, useState } from 'react'
import AuthLayout, { inputClass, linkButtonClass, primaryButtonClass } from '../auth-layout'

const ALLOWED_TYPES: EmailOtpType[] = ['invite', 'magiclink', 'signup', 'recovery', 'email']

type Status = 'verifying' | 'invalid' | 'ready'

export default function ConfirmPage() {
  const router = useRouter()
  const [status, setStatus] = useState<Status>('verifying')
  const [email, setEmail] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasVerified = useRef(false)

  useEffect(() => {
    // The token works once; guard against React running effects twice in dev
    if (hasVerified.current) return
    hasVerified.current = true

    const params = new URLSearchParams(window.location.search)
    const tokenHash = params.get('token_hash')
    const type = params.get('type') as EmailOtpType | null
    // Keep the one-time token out of the address bar and history
    window.history.replaceState(null, '', '/host/confirm')

    if (!tokenHash || !type || !ALLOWED_TYPES.includes(type)) {
      setStatus('invalid')
      return
    }

    supabase.auth.verifyOtp({ token_hash: tokenHash, type }).then(({ data, error }) => {
      if (error || !isStaffUser(data.user)) {
        if (data.session) supabase.auth.signOut()
        setStatus('invalid')
        return
      }
      setEmail(data.user?.email ?? null)
      setStatus('ready')
    })
  }, [])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`)
      return
    }
    if (password !== confirmation) {
      setError('The passwords don’t match.')
      return
    }
    setIsSaving(true)
    const { error } = await supabase.auth.updateUser({ password })
    setIsSaving(false)
    if (error) {
      setError(
        error.message.toLowerCase().includes('different')
          ? 'Choose a password different from your current one.'
          : 'Couldn’t save your password. Try a stronger one.'
      )
      return
    }
    router.replace('/host/dashboard')
  }

  if (status === 'verifying') {
    return (
      <AuthLayout title="Checking your link…">
        <p className="text-sm text-gray-600 motion-safe:animate-breathe">One moment.</p>
      </AuthLayout>
    )
  }

  if (status === 'invalid') {
    return (
      <AuthLayout
        title="This link doesn’t work anymore"
        subtitle="Links work once and expire after a while. Ask for a new one and use the latest email."
      >
        <Link href="/host/login" className={`grid place-items-center ${primaryButtonClass}`}>
          Get a new link
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Choose your password"
      subtitle={
        email ? (
          <>
            For <strong className="text-gray-900">{email}</strong>. You’ll use it to sign in next time.
          </>
        ) : undefined
      }
    >
      <form onSubmit={onSubmit} noValidate>
        {/* Lets password managers save the pair */}
        <input type="email" autoComplete="username" value={email ?? ''} readOnly hidden />

        <label className="block text-sm font-semibold text-gray-800" htmlFor="new-password">
          New password
        </label>
        <input
          id="new-password"
          type="password"
          autoComplete="new-password"
          className={inputClass}
          value={password}
          onChange={(e) => setPassword(e.currentTarget.value)}
          aria-describedby="password-hint"
          autoFocus
        />
        <p id="password-hint" className="mt-1.5 text-xs text-gray-500">
          At least {MIN_PASSWORD_LENGTH} characters.
        </p>

        <label className="mt-4 block text-sm font-semibold text-gray-800" htmlFor="confirm-password">
          Repeat it
        </label>
        <input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          className={inputClass}
          value={confirmation}
          onChange={(e) => setConfirmation(e.currentTarget.value)}
        />

        {error && (
          <p role="alert" className="mt-4 text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        <button className={`mt-6 ${primaryButtonClass}`} disabled={isSaving || !password || !confirmation}>
          {isSaving ? 'Saving…' : 'Save and continue'}
        </button>
      </form>
      <p className="mt-6 text-sm text-gray-600 text-center">
        Not you?{' '}
        <button
          className={linkButtonClass}
          onClick={async () => {
            await supabase.auth.signOut()
            router.replace('/host/login')
          }}
        >
          Sign out
        </button>
      </p>
    </AuthLayout>
  )
}

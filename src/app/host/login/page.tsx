'use client'

import { isStaffEmail, isStaffUser, normalizeEmail, STAFF_EMAIL_DOMAIN } from '@/lib/staff'
import { useStaffSession } from '@/lib/use-staff-session'
import { supabase } from '@/types/types'
import { useRouter } from 'next/navigation'
import { FormEvent, useEffect, useState } from 'react'
import AuthLayout, { inputClass, linkButtonClass, primaryButtonClass } from '../auth-layout'

type Mode = 'sign-in' | 'create' | 'reset'

export default function LoginPage() {
  const session = useStaffSession()
  const router = useRouter()

  const [mode, setMode] = useState<Mode>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)

  useEffect(() => {
    if (session.status === 'signed-in') router.replace('/host/dashboard')
  }, [session.status, router])

  const switchMode = (next: Mode) => {
    setMode(next)
    setError(null)
    setSentTo(null)
  }

  const onSignIn = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const normalized = normalizeEmail(email)
    if (!isStaffEmail(normalized)) {
      setError(`Use your @${STAFF_EMAIL_DOMAIN} email address.`)
      return
    }
    setIsBusy(true)
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalized,
      password,
    })
    setIsBusy(false)
    if (error || !isStaffUser(data.user)) {
      setError('Wrong email or password.')
      return
    }
    router.replace('/host/dashboard')
  }

  const onRequestLink = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const normalized = normalizeEmail(email)
    if (!isStaffEmail(normalized)) {
      setError(`Only @${STAFF_EMAIL_DOMAIN} email addresses can have an account.`)
      return
    }
    setIsBusy(true)
    try {
      const response = await fetch('/api/auth/request-link', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: normalized }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(body.error ?? 'Something went wrong. Try again.')
        return
      }
      setSentTo(normalized)
    } catch {
      setError('Couldn’t reach the server. Check your connection and try again.')
    } finally {
      setIsBusy(false)
    }
  }

  if (session.status !== 'signed-out') {
    return (
      <div className="min-h-dvh bg-green-700 grid place-items-center">
        <p className="text-green-50 font-medium motion-safe:animate-breathe">Loading…</p>
      </div>
    )
  }

  if (sentTo) {
    return (
      <AuthLayout
        title="Check your inbox"
        subtitle={
          <>
            We sent a link to <strong className="text-gray-900">{sentTo}</strong>. Open it to
            {mode === 'create' ? ' finish creating your account' : ' choose a new password'}.
          </>
        }
      >
        <p className="text-sm text-gray-600">
          Didn’t get it? Check your spam folder, or{' '}
          <button className={linkButtonClass} onClick={() => setSentTo(null)}>
            send it again
          </button>
          .
        </p>
        <button className={`mt-6 ${primaryButtonClass}`} onClick={() => switchMode('sign-in')}>
          Back to sign in
        </button>
      </AuthLayout>
    )
  }

  if (mode === 'sign-in') {
    return (
      <AuthLayout title="Sign in to host" subtitle="Create, edit and run quizzes for your class.">
        <form onSubmit={onSignIn} noValidate>
          <label className="block text-sm font-semibold text-gray-800" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            className={inputClass}
            placeholder={`you@${STAFF_EMAIL_DOMAIN}`}
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
            required
            autoFocus
          />

          <div className="mt-4 flex items-baseline justify-between">
            <label className="block text-sm font-semibold text-gray-800" htmlFor="password">
              Password
            </label>
            <button type="button" className={`text-sm ${linkButtonClass}`} onClick={() => switchMode('reset')}>
              Forgot it?
            </button>
          </div>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            className={inputClass}
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
            required
          />

          {error && (
            <p role="alert" className="mt-4 text-sm font-medium text-red-700">
              {error}
            </p>
          )}

          <button className={`mt-6 ${primaryButtonClass}`} disabled={isBusy || !email || !password}>
            {isBusy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-sm text-gray-600 text-center">
          New here?{' '}
          <button className={linkButtonClass} onClick={() => switchMode('create')}>
            Create an account
          </button>
        </p>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title={mode === 'create' ? 'Create your account' : 'Reset your password'}
      subtitle={
        mode === 'create'
          ? `Accounts are for @${STAFF_EMAIL_DOMAIN} addresses. We’ll email you a link to choose your password.`
          : 'We’ll email you a link to choose a new password.'
      }
    >
      <form onSubmit={onRequestLink} noValidate>
        <label className="block text-sm font-semibold text-gray-800" htmlFor="request-email">
          Your @{STAFF_EMAIL_DOMAIN} email
        </label>
        <input
          id="request-email"
          type="email"
          autoComplete="email"
          inputMode="email"
          className={inputClass}
          placeholder={`you@${STAFF_EMAIL_DOMAIN}`}
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value)}
          required
          autoFocus
        />

        {error && (
          <p role="alert" className="mt-4 text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        <button className={`mt-6 ${primaryButtonClass}`} disabled={isBusy || !email}>
          {isBusy ? 'Sending…' : 'Email me a link'}
        </button>
      </form>

      <p className="mt-6 text-sm text-gray-600 text-center">
        Already have a password?{' '}
        <button className={linkButtonClass} onClick={() => switchMode('sign-in')}>
          Sign in
        </button>
      </p>
    </AuthLayout>
  )
}

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { isStaffEmail, normalizeEmail } from '@/lib/staff'

// Sends a one-time link (via Brevo) that either finishes creating a new
// @tec.mx host account or lets an existing one set a new password.
// The response is the same in both cases so it doesn't reveal who has an account.

const RESEND_COOLDOWN_MS = 60_000
const recentRequests = new Map<string, number>()

const siteUrl = (request: Request) => {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, '')
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  // Local development only
  return new URL(request.url).origin
}

const emailHtml = (link: string) => `<!doctype html>
<html><body style="margin:0;background:#f0fdf4;font-family:Inter,Segoe UI,Arial,sans-serif;color:#052e16">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden">
        <tr><td style="background:#15803d;padding:24px 28px;color:#ffffff;font-size:20px;font-weight:800">SupaQuiz</td></tr>
        <tr><td style="padding:28px">
          <p style="margin:0 0 12px;font-size:18px;font-weight:700">Set your SupaQuiz password</p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#14532d">
            Open the link below to finish creating your host account, or to choose a new password if you already have one.
          </p>
          <a href="${link}" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:12px">Set my password</a>
          <p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#4b5563">
            The link works once and expires soon. If you didn’t ask for this, you can ignore this email.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`

const emailText = (link: string) =>
  `Set your SupaQuiz password\n\nOpen this link to finish creating your host account, or to choose a new password if you already have one:\n\n${link}\n\nThe link works once and expires soon. If you didn't ask for this, you can ignore this email.\n`

export async function POST(request: Request) {
  let email = ''
  try {
    const body = await request.json()
    email = typeof body?.email === 'string' ? normalizeEmail(body.email) : ''
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  if (!isStaffEmail(email) || email.length > 254) {
    return NextResponse.json(
      { error: 'Only @tec.mx email addresses can have an account.' },
      { status: 400 }
    )
  }

  const now = Date.now()
  const last = recentRequests.get(email)
  if (last && now - last < RESEND_COOLDOWN_MS) {
    return NextResponse.json(
      { error: 'We just sent a link to this address. Wait a minute before asking again.' },
      { status: 429 }
    )
  }

  const apiKey = process.env.BREVO_API_KEY
  const senderEmail = process.env.BREVO_SENDER_EMAIL
  if (!apiKey || !senderEmail) {
    console.error('request-link: BREVO_API_KEY or BREVO_SENDER_EMAIL is not set')
    return NextResponse.json({ error: 'Email is not configured yet.' }, { status: 500 })
  }

  const admin = createAdminClient()

  // New address → invite (creates a passwordless account).
  // Existing address → magic link (signs in so they can set a new password).
  let linkData = await admin.auth.admin.generateLink({ type: 'invite', email })
  if (linkData.error) {
    linkData = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  }
  if (linkData.error || !linkData.data?.properties) {
    console.error('request-link: generateLink failed', linkData.error?.message)
    return NextResponse.json(
      { error: 'We couldn’t prepare your link. Try again in a few minutes.' },
      { status: 502 }
    )
  }

  const { hashed_token, verification_type } = linkData.data.properties
  const link = `${siteUrl(request)}/host/confirm?token_hash=${encodeURIComponent(
    hashed_token
  )}&type=${encodeURIComponent(verification_type)}`

  const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { name: 'SupaQuiz', email: senderEmail },
      to: [{ email }],
      subject: 'Set your SupaQuiz password',
      htmlContent: emailHtml(link),
      textContent: emailText(link),
    }),
  })

  if (!brevoResponse.ok) {
    console.error('request-link: Brevo error', brevoResponse.status, await brevoResponse.text())
    return NextResponse.json(
      { error: 'We couldn’t send the email. Try again in a few minutes.' },
      { status: 502 }
    )
  }

  recentRequests.set(email, now)
  return NextResponse.json({ ok: true })
}

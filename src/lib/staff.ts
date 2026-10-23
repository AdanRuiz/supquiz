import type { Session, User } from '@supabase/supabase-js'

/** Only @tec.mx addresses can have a host account. Mirrors public.is_staff() in the DB. */
export const STAFF_EMAIL_DOMAIN = 'tec.mx'

const STAFF_EMAIL_PATTERN = /^[^@\s]+@tec\.mx$/i

export const normalizeEmail = (email: string) => email.trim().toLowerCase()

export const isStaffEmail = (email: string | null | undefined) =>
  !!email && STAFF_EMAIL_PATTERN.test(normalizeEmail(email))

export const isStaffUser = (user: User | null | undefined) =>
  // is_anonymous isn't in this supabase-js version's User type yet
  !!user && !(user as User & { is_anonymous?: boolean }).is_anonymous && isStaffEmail(user.email)

export const isStaffSession = (session: Session | null | undefined) =>
  isStaffUser(session?.user)

export const MIN_PASSWORD_LENGTH = 8

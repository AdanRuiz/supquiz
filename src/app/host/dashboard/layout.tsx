import type { Metadata } from 'next'
import '../../globals.css'
import Link from 'next/link'
import BrandMark from '../brand-mark'
import Nav from './nav'

export const metadata: Metadata = {
  title: 'SupaQuiz',
  description: 'Fun quiz game powered by Supabase',
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-dvh bg-green-50 text-gray-900 md:flex">
      <aside className="shrink-0 bg-green-950 text-white md:w-60 md:h-dvh md:sticky md:top-0 flex flex-col">
        <div className="flex items-center justify-between gap-4 px-4 md:px-5 h-16">
          <Link
            href="/host/dashboard"
            className="flex items-center gap-2.5 rounded-md font-extrabold text-xl tracking-tight"
          >
            <BrandMark className="w-7 h-7" />
            SupaQuiz
          </Link>
        </div>
        <div className="px-3 pb-3 md:pt-2">
          <Nav />
        </div>
        <p className="hidden md:block mt-auto px-5 py-5 text-xs text-green-300/80">
          Open-source quiz game powered by Supabase
        </p>
      </aside>
      <main className="flex-grow min-w-0 px-4 py-6 md:px-10 md:py-10">{children}</main>
    </div>
  )
}

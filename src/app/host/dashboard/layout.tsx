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
    <div className="min-h-dvh bg-gray-50 text-gray-900">
      <header className="h-14 px-4 md:px-6 flex items-center bg-white border-b border-gray-200">
        <Link
          href="/host/dashboard"
          className="flex items-center gap-2 rounded-md font-bold text-lg tracking-tight"
        >
          <BrandMark />
          SupaQuiz
        </Link>
      </header>
      <div className="flex flex-col md:flex-row">
        <aside className="md:w-56 shrink-0 p-3 bg-white border-b md:border-b-0 md:border-r border-gray-200 md:min-h-[calc(100dvh-3.5rem)]">
          <Nav />
        </aside>
        <main className="flex-grow min-w-0 px-4 py-8 md:px-10">{children}</main>
      </div>
    </div>
  )
}

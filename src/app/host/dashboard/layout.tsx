import type { Metadata } from 'next'
import '../../globals.css'
import DashboardShell from './shell'

export const metadata: Metadata = {
  title: 'SupQuiz',
  description: 'Fun quiz game powered by Supabase',
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <DashboardShell>{children}</DashboardShell>
}

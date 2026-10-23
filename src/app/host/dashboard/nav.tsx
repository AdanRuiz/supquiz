'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const menuItems: {
  label: string
  href: string
  icon: React.ReactNode
}[] = [
  {
    label: 'Quiz sets',
    href: '/host/dashboard',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
      />
    ),
  },
  {
    label: 'How to play',
    href: '/host/dashboard/how-to',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z"
      />
    ),
  },
]

export default function Nav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Dashboard">
      <ul className="flex md:flex-col gap-1">
        {menuItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center gap-3 h-10 px-3 rounded-lg text-sm font-semibold transition-colors ${
                  isActive
                    ? 'bg-white/10 text-white'
                    : 'text-green-200 hover:bg-white/5 hover:text-white'
                }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.75}
                  stroke="currentColor"
                  className="w-5 h-5 shrink-0"
                  aria-hidden="true"
                >
                  {item.icon}
                </svg>
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

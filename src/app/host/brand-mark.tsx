'use client'

import { KITTEN_IMAGES, useKitten } from '@/lib/kitten'

// The four answer colors as the SupQuiz mark (or the kitten logo in Kitten mode)
export default function BrandMark({ className = 'w-6 h-6' }: { className?: string }) {
  const { enabled, onLogoTap } = useKitten()

  const mark = enabled ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={KITTEN_IMAGES.logo} alt="" className={`${className} object-contain`} />
  ) : (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="1" y="1" width="10" height="10" rx="2.5" fill="#ef4444" />
      <rect x="13" y="1" width="10" height="10" rx="2.5" fill="#3b82f6" />
      <rect x="1" y="13" width="10" height="10" rx="2.5" fill="#eab308" />
      <rect x="13" y="13" width="10" height="10" rx="2.5" fill="#22c55e" />
    </svg>
  )

  // Hosts can tap the logo to toggle Kitten mode; nothing hints at it
  if (!onLogoTap) return mark
  return (
    <span onClick={onLogoTap} className="inline-flex">
      {mark}
    </span>
  )
}

// The four answer colors as the SupQuiz mark
export default function BrandMark({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="1" y="1" width="10" height="10" rx="2.5" fill="#ef4444" />
      <rect x="13" y="1" width="10" height="10" rx="2.5" fill="#3b82f6" />
      <rect x="1" y="13" width="10" height="10" rx="2.5" fill="#eab308" />
      <rect x="13" y="13" width="10" height="10" rx="2.5" fill="#22c55e" />
    </svg>
  )
}

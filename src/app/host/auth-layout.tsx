import BrandMark from './brand-mark'

/** Green full-screen frame with a white card, shared by login and confirm pages. */
export default function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="min-h-dvh bg-green-700 flex flex-col px-4 py-8">
      <div className="flex items-center justify-center gap-2.5 text-white font-extrabold text-xl tracking-tight">
        <BrandMark className="w-7 h-7" />
        SupaQuiz
      </div>
      <div className="flex-grow flex items-center justify-center py-8">
        <div className="w-full max-w-sm rounded-3xl bg-white p-7 shadow-[0_24px_48px_-16px_rgba(2,44,22,0.6)]">
          <h1 className="text-2xl font-extrabold tracking-tight text-green-950">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-gray-600 leading-relaxed">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  )
}

export const inputClass =
  'mt-1.5 w-full h-12 px-4 rounded-xl bg-white ring-1 ring-gray-300 text-base text-gray-900 placeholder:text-gray-400 outline-none transition-shadow focus:ring-2 focus:ring-green-600'

export const primaryButtonClass =
  'w-full h-12 rounded-xl bg-green-600 text-white font-bold transition-[background-color,transform] hover:bg-green-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-green-600/50'

export const linkButtonClass =
  'font-semibold text-green-700 underline underline-offset-2 decoration-green-700/30 hover:decoration-green-700'

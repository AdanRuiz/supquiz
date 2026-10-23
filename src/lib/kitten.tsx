'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

/*
 * Kitten mode: a hidden theme the host can switch on.
 * Two ways to toggle it, host screens only:
 *   - type the secret word anywhere outside a text field
 *   - tap the logo 7 times in a row
 * The word is stored as a hash so it isn't sitting in the source as plain text.
 */

export const KITTEN_IMAGES = {
  logo: '/kitten/logo_kitten.webp',
  happy: '/kitten/gatito_feliz.webp',
  winner: '/kitten/science_kitten.webp',
  wrong: [1, 2, 3, 4, 5].map((n) => `/kitten/kitten${n}.webp`),
}

const SECRET_LENGTH = 4
const SECRET_HASH = 0x6e6f9109
const TAPS_TO_TOGGLE = 7
const TAP_WINDOW_MS = 1500
const PREFERENCE_KEY = 'supquiz.kitten'

// FNV-1a: tiny, good enough to hide a word from a casual look at the code
const hash = (text: string) => {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h
}

type KittenContextValue = { enabled: boolean; onLogoTap?: () => void }
const KittenContext = createContext<KittenContextValue>({ enabled: false })

export const useKitten = () => useContext(KittenContext)

export function KittenProvider({
  enabled,
  onToggle,
  children,
}: {
  enabled: boolean
  /** Only hosts get a toggle; players just follow the game. */
  onToggle?: () => void
  children: React.ReactNode
}) {
  const [toast, setToast] = useState<string | null>(null)
  const previous = useRef(enabled)
  const toggledByHost = useRef(false)

  const handleToggle = useCallback(() => {
    toggledByHost.current = true
    onToggle?.()
  }, [onToggle])
  const onLogoTap = useKittenTrigger(onToggle ? handleToggle : undefined)

  // Brief confirmation, only right after the host toggles it (not on page load)
  useEffect(() => {
    if (previous.current === enabled) return
    previous.current = enabled
    if (!toggledByHost.current) return
    toggledByHost.current = false
    setToast(enabled ? 'Kitten mode on' : 'Kitten mode off')
    const timer = setTimeout(() => setToast(null), 2200)
    return () => clearTimeout(timer)
  }, [enabled])

  // Warm the cache so images appear instantly when they're needed
  useEffect(() => {
    if (!enabled) return
    ;[KITTEN_IMAGES.logo, KITTEN_IMAGES.happy, KITTEN_IMAGES.winner, ...KITTEN_IMAGES.wrong].forEach(
      (src) => {
        const image = new Image()
        image.src = src
      }
    )
  }, [enabled])

  return (
    <KittenContext.Provider value={{ enabled, onLogoTap: onToggle ? onLogoTap : undefined }}>
      {children}
      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full bg-green-950 text-white pl-2 pr-4 py-2 text-sm font-bold shadow-[0_12px_32px_-12px_rgba(0,0,0,0.6)] motion-safe:animate-pop-in"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={KITTEN_IMAGES.logo} alt="" className="w-7 h-7 object-contain" />
          {toast}
        </div>
      )}
    </KittenContext.Provider>
  )
}

/** Keyboard + logo-tap triggers. Returns the logo tap handler. */
function useKittenTrigger(onToggle?: () => void) {
  const typed = useRef('')
  const taps = useRef<{ count: number; last: number }>({ count: 0, last: 0 })

  useEffect(() => {
    if (!onToggle) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1) return
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return
      typed.current = (typed.current + event.key.toLowerCase()).slice(-SECRET_LENGTH)
      if (typed.current.length === SECRET_LENGTH && hash(typed.current) === SECRET_HASH) {
        typed.current = ''
        onToggle()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onToggle])

  return useCallback(() => {
    if (!onToggle) return
    const now = Date.now()
    const state = taps.current
    state.count = now - state.last < TAP_WINDOW_MS ? state.count + 1 : 1
    state.last = now
    if (state.count >= TAPS_TO_TOGGLE) {
      state.count = 0
      onToggle()
    }
  }, [onToggle])
}

/** The host's choice, remembered in this browser for new games. */
export const readKittenPreference = () => {
  try {
    return window.localStorage.getItem(PREFERENCE_KEY) === 'on'
  } catch {
    return false
  }
}

export const writeKittenPreference = (enabled: boolean) => {
  try {
    window.localStorage.setItem(PREFERENCE_KEY, enabled ? 'on' : 'off')
  } catch {
    // Private mode or blocked storage: the mode still works for this page
  }
}

export const randomWrongKitten = () =>
  KITTEN_IMAGES.wrong[Math.floor(Math.random() * KITTEN_IMAGES.wrong.length)]

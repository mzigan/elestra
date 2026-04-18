import { useEffect } from 'elestra'
import type { Signal } from 'elestra'

export function useScrollLock(enabled: Signal<boolean>) {
  useEffect(() => {
    if (!enabled()) return

    // Вычисляем ширину скроллбара, чтобы страница не прыгала при overflow: hidden
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
    
    document.body.style.overflow = 'hidden'
    document.body.style.paddingRight = `${scrollbarWidth}px`

    return () => {
      document.body.style.overflow = ''
      document.body.style.paddingRight = ''
    }
  })
}

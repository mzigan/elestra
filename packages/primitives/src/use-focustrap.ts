// primitives/shared/useFocusTrap.ts
import { useEffect } from 'elestra'
import type { Signal } from 'elestra'

export function useFocusTrap(
  getElement: () => HTMLElement | null, 
  enabled: Signal<boolean>
) {
  // Храним ссылку на элемент ДО открытия ловушки.
  // Переменная живет вне эффекта, поэтому сохраняется между его перезапусками.
  let previouslyFocused: HTMLElement | null = null

  useEffect(() => {
    if (!enabled()) return
    
    const el = getElement()
    if (!el) return

    // 1. Запоминаем, где был фокус до открытия
    previouslyFocused = document.activeElement as HTMLElement

    const FOCUSABLE_SELECTORS = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    
    const getFocusableElements = () => [...el.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)]

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      const focusable = getFocusableElements()
      if (focusable.length === 0) return

      const first = focusable[0]!
      const last = focusable[focusable.length - 1]!

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    // 2. Фокусируем первый элемент ПРИ открытии
    const focusable = getFocusableElements()
    focusable[0]?.focus()

    el.addEventListener('keydown', handleKeyDown)
    
    return () => {
      el.removeEventListener('keydown', handleKeyDown)
      
      // 3. ВОЗВРАТ ФОКУСА ПРИ ЗАКРЫТИИ
      // Cleanup запускается синхронно когда enabled() становится false
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus()
      }
    }
  })
}

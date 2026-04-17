import { useEffect } from 'elestra'
import type { Signal } from 'elestra'

interface UseDismissableOptions {
  enabled: Signal<boolean>
  onDismiss: () => void
}

export function useDismissable(
  getElement: () => HTMLElement | null, 
  opts: UseDismissableOptions
) {
  useEffect(() => {
    // Если отключено — ничего не делаем (эффект переподпишется, если enabled изменится)
    if (!opts.enabled()) return

    const onPointerDown = (e: PointerEvent) => {
      const el = getElement()
      // Если клик вне элемента
      if (el && !el.contains(e.target as Node)) {
        opts.onDismiss()
      }
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        opts.onDismiss()
      }
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)

    // useEffect автоматически вызовет эту функцию при _destroy() компонента
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  })
}

import { signal, type Signal } from 'elestra'

export interface DisclosureAPI {
  /** Сигнал состояния. Передаем напрямую в .attr(), .classIf() или useEffect */
  open: Signal<boolean>
  /** Действия */
  show: () => void
  close: () => void
  toggle: () => void
}

export function createDisclosure(initialValue = false): DisclosureAPI {
  const open = signal(initialValue)
  
  return {
    open,
    show: () => open.set(true),
    close: () => open.set(false),
    toggle: () => open.update(v => !v),
  }
}

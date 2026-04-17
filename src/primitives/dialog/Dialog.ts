import { defineComponent, injectionKey, provideLocal } from "../../component"
import { div, type Child } from "../../element-builder"
import { signal, type Signal } from "../../reactivity"
import { createDisclosure } from "../createDisclosure"
import { useDismissable } from "../useDismissable"
import { useFocusTrap } from "../useFocustrap"

export type DialogAPI = { open: Signal<boolean>; show: () => void; close: () => void }
export const DIALOG_API_KEY = injectionKey<DialogAPI>('dialog-api')
export const DIALOG_PANEL_KEY = injectionKey<Signal<HTMLElement | null>>('dialog-panel')

type DialogProps = {
  default?: () => Child
}

export const Dialog = defineComponent<DialogProps>((props) => {
  const { open, show, close } = createDisclosure(false)
  const panelRef = signal<HTMLElement | null>(null)

  provideLocal(DIALOG_API_KEY, { open, show, close })
  provideLocal(DIALOG_PANEL_KEY, panelRef)

  useDismissable(() => panelRef(), { enabled: open, onDismiss: close })
  useFocusTrap(() => panelRef(), open)

  return div()
    .attr('data-state', () => open() ? 'open' : 'closed')
    // Вызываем пропс-функцию внутри геттера .child() 
    // Если default не передан, вернет undefined, и .child() ничего не сделает
    .child(() => props.default?.())
})

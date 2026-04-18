import { defineComponent, injectionKey, provideLocal, type Child, portal, signal, type Signal } from "elestra"
import { createDisclosure } from "../create-disclosure"
import { useDismissable } from "../use-dismissable"
import { useFocusTrap } from "../use-focustrap"
import { useScrollLock } from "../use-scroll-lock"
import { useId } from "../use-id"

export type DialogAPI = { open: Signal<boolean>; show: () => void; close: () => void }
export const DIALOG_API_KEY = injectionKey<DialogAPI>('dialog-api')
export const DIALOG_PANEL_KEY = injectionKey<Signal<HTMLElement | null>>('dialog-panel')
export const DIALOG_PANEL_ID_KEY = injectionKey<string>('dialog-panel-id')

type DialogProps = {
  default?: () => Child
}

export const Dialog = defineComponent<DialogProps>((props) => {
  const { open, show, close } = createDisclosure(false)
  const panelRef = signal<HTMLElement | null>(null)
  const panelId = useId('dialog-panel')

  provideLocal(DIALOG_API_KEY, { open, show, close })
  provideLocal(DIALOG_PANEL_KEY, panelRef)
  provideLocal(DIALOG_PANEL_ID_KEY, panelId)

  useDismissable(() => panelRef(), { enabled: open, onDismiss: close })
  useFocusTrap(() => panelRef(), open)
  useScrollLock(open)

  // Теперь мы просто используем portal() как обычный билдер!
  return portal(document.body)
    .attr('data-state', () => open() ? 'open' : 'closed')
    .child(() => props.default?.())
})

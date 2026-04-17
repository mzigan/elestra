import { defineComponent, inject } from 'elestra'
import { div, type Child } from 'elestra'
import { type Signal } from 'elestra'
import { DIALOG_API_KEY, DIALOG_PANEL_KEY, type DialogAPI } from './dialog'

type DialogPanelProps = {
  default?: () => Child
}

export const DialogPanel = defineComponent<DialogPanelProps>((props) => {
  const ctx = inject<DialogAPI>(DIALOG_API_KEY)!
  const panelRef = inject<Signal<HTMLElement | null>>(DIALOG_PANEL_KEY)!

  return div()
    .attr('role', 'dialog')
    .attr('aria-modal', 'true')
    .attr('data-state', () => ctx.open() ? 'open' : 'closed')
    .ref(el => panelRef.set(el)) // Кладем DOM-узел в сигнал для хуков
    .child(() => props.default?.())
})

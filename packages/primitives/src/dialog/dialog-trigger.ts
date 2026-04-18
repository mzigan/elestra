import { defineComponent, inject } from 'elestra'
import { button, type Child } from 'elestra'
import { DIALOG_API_KEY, DIALOG_PANEL_ID_KEY, type DialogAPI } from './dialog'
import { ariaExpanded, ariaControls } from '../aria'

type DialogTriggerProps = {
  default?: () => Child
}

export const DialogTrigger = defineComponent<DialogTriggerProps>((props) => {
  const ctx = inject<DialogAPI>(DIALOG_API_KEY)!
  const panelId = inject<string>(DIALOG_PANEL_ID_KEY)!

  // Применяем ARIA атрибуты типизированными функциями
  return ariaExpanded(
    ariaControls(
      button()
        .attr('type', 'button')
        .attr('aria-haspopup', 'dialog') // Стандартный атрибут для триггера диалога
        .on('click', () => ctx.show()),
      panelId
    ),
    ctx.open
  ).child(() => props.default?.())
})

import { defineComponent, inject } from 'elestra'
import { button, type Child } from 'elestra'
import { DIALOG_API_KEY, type DialogAPI } from './dialog'

type DialogTriggerProps = {
  default?: () => Child
}

export const DialogTrigger = defineComponent<DialogTriggerProps>((props) => {
  const ctx = inject<DialogAPI>(DIALOG_API_KEY)!

  return button()
    .attr('type', 'button')
    .on('click', () => ctx.show())
    .child(() => props.default?.())
})
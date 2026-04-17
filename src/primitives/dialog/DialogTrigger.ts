// primitives/dialog/DialogTrigger.ts
import { defineComponent, inject } from '../../component'
import { button, type Child } from '../../element-builder'
import { DIALOG_API_KEY, type DialogAPI } from './Dialog'

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
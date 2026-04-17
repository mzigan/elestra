// ui/UIDialog.ts
import { Dialog } from '../primitives/dialog/Dialog'
import { div } from '../element-builder'
import { DialogTrigger } from '../primitives/dialog/DialogTrigger'
import { DialogPanel } from '../primitives/dialog/DialogPanel'

export const UIDialog = () => Dialog({
  default: () => div().children(
    DialogTrigger({
      default: () => div()
        .class('px-4 py-2 bg-primary text-primary-foreground rounded-md')
        .text('Open Dialog')
    }),
    DialogPanel({
      default: () => div()
        .class('fixed inset-0 z-50 flex items-center justify-center')
        .child(
          div()
            .class('data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 bg-black/80')
        )
        .child(
          div()
            .class('data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed bg-background p-6 shadow-lg rounded-lg')
            .children(
              div().text("Hello from Elestra shadcn!"),
              div().text("Press Escape or click outside.")
            )
        )
    })
  )
})
import { defineComponent, button, type Child, type MaybeReactive, isGetter } from 'elestra'

type ButtonVariant = 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
type ButtonSize = 'default' | 'sm' | 'lg' | 'icon'

export type ButtonProps = {
  variant?: MaybeReactive<ButtonVariant>
  size?: MaybeReactive<ButtonSize>
  disabled?: MaybeReactive<boolean>
  type?: 'button' | 'submit' | 'reset'
  class?: MaybeReactive<string>
  default?: () => Child
}

export const Button = defineComponent<ButtonProps>((props) => {
  
  const variants: Record<ButtonVariant, string> = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
    destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    ghost: "hover:bg-accent hover:text-accent-foreground",
    link: "text-primary underline-offset-4 hover:underline",
  }

  const sizes: Record<ButtonSize, string> = {
    default: "h-10 px-4 py-2",
    sm: "h-9 rounded-md px-3",
    lg: "h-11 rounded-md px-8",
    icon: "h-10 w-10",
  }

  const baseClasses = "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"

  // ✅ Локальный хелпер для безопасного извлечения значения из MaybeReactive
  // Если это функция (сигнал/компьютед) — вызываем её. Если нет — берем как есть. Если undefined — берем fallback.
  function resolve<T>(val: MaybeReactive<T> | undefined, fallback: T): T {
    return isGetter(val) ? val() : (val ?? fallback)
  }

  return button()
    .attr('type', props.type || 'button')
    // Передаем геттер в .attr() безопасно
    .attr('disabled', () => resolve(props.disabled, false))
    .class(() => {
      // ✅ Теперь TypeScript точно знает, что 'v' и 's' — это строки, а не функции!
      // Ошибки индексации Record пропадут.
      const v = resolve(props.variant, 'default')
      const s = resolve(props.size, 'default')
      const userClass = resolve(props.class, '')
      
      return `${baseClasses} ${variants[v]} ${sizes[s]} ${userClass}`.trim()
    })
    .child(() => props.default?.())
})

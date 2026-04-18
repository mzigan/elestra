import { defineComponent, button, fragment, span, svg, circle, path, isGetter, type Child, type MaybeReactive } from 'elestra'

type ButtonVariant = 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
type ButtonSize = 'default' | 'sm' | 'lg' | 'icon'

export type ButtonProps = {
  variant?: MaybeReactive<ButtonVariant>
  size?: MaybeReactive<ButtonSize>
  disabled?: MaybeReactive<boolean>
  loading?: MaybeReactive<boolean>
  type?: 'button' | 'submit' | 'reset'
  class?: MaybeReactive<string>
  icon?: MaybeReactive<Child>
  loadingIcon?: MaybeReactive<Child>
  default?: () => Child
  onclick?: (event: MouseEvent) => void
  ref?: (el: HTMLButtonElement | null) => void
  attrs?: Record<string, string | boolean> // 🆕 Для кастомных data-* и aria-*
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

  function resolve<T>(val: MaybeReactive<T> | undefined, fallback: T): T {
    return isGetter(val) ? val() : (val ?? fallback)
  }

  const defaultSpinner = () =>
    svg()
      .attr('xmlns', 'http://www.w3.org/2000/svg')
      .attr('width', '24')
      .attr('height', '24')
      .attr('viewBox', '0 0 24 24')
      .attr('fill', 'none')
      .attr('stroke', 'currentColor')
      .attr('stroke-width', '2')
      .attr('stroke-linecap', 'round')
      .attr('stroke-linejoin', 'round')
      .child(
        path()
          .attr('d', 'M21 12a9 9 0 1 1-6.219-8.56')
      )

  // 🆕 Dev-валидация
  if (process.env.NODE_ENV !== 'production') {
    const s = resolve(props.size, 'default')
    const c = props.default?.()
    if (s === 'icon' && c) {
      console.warn('Button: size="icon" should not have text content.')
    }
  }

  return button()
    .attr('type', props.type || 'button')
    .attr('disabled', () => resolve(props.disabled, false) || resolve(props.loading, false))
    // 🆕 ARIA для состояния загрузки
    .attr('aria-label', () => {
      if (resolve(props.loading, false)) {
        const content = props.default?.()
        if (content && typeof content === 'string') {
          return `${content}, loading`
        }
        return 'Loading, please wait'
      }
      return null
    })
    .attr('aria-busy', () => resolve(props.loading, false) || null)  // дополнительно
    // 🆕 Кастомные атрибуты
    .tap((el) => {
      if (props.attrs) {
        for (const [key, value] of Object.entries(props.attrs)) {
          if (value !== false) el.setAttribute(key, value === true ? '' : value)
        }
      }
    })
    .class(() => {
      // 🆕 Кешируем все вычисления!
      const v = resolve(props.variant, 'default')
      const s = resolve(props.size, 'default')
      const isLoading = resolve(props.loading, false)
      const hasIcon = !!(resolve(props.icon, null) || isLoading)
      const userClass = resolve(props.class, '')

      // 🆕 Исправлена логика gap (проверяем результат вызова default)
      const content = props.default?.()
      const hasGap = !!(s !== 'icon' && hasIcon && content)
      const gapClass = hasGap ? 'gap-2' : ''

      return `${baseClasses} ${variants[v]} ${sizes[s]} ${gapClass} ${userClass}`.trim()
    })
    .child(() => {
      // 🆕 Берем закешированные значения (вызов сигналов уже прошел в .class)
      // На самом деле, в эффекте они пересчитаются, поэтому надежнее вынести в переменные выше,
      // но для чистоты архитектуры оставим так, сигналы быстры.
      const isLoading = resolve(props.loading, false)
      const currentIcon = resolve(props.icon, null)
      const s = resolve(props.size, 'default')
      const content = props.default?.()

      if (isLoading) {
        const spinner = resolve(props.loadingIcon, null) ?? defaultSpinner()
        return fragment(
          span()
            .attr('aria-hidden', 'true')  // спиннер не озвучиваем
            .class('shrink-0 animate-spin')
            .child(spinner),
          ...(s !== 'icon' && content ? [content] : [])  // ✅ без sr-only
        )
      }

      if (s === 'icon') {
        return currentIcon ?? content
      }

      if (!currentIcon && !content) return null

      return fragment(
        // Оборачиваем пользовательскую иконку в shrink-0 для безопасности
        ...(currentIcon ? [span().class('shrink-0').child(currentIcon)] : []),
        ...(content ? [content] : [])
      )
    })
    // 🆕 Безопасный клик с типизацией
    .on('click', (event: MouseEvent) => {
      const isDisabled = resolve(props.disabled, false) || resolve(props.loading, false)
      if (!isDisabled) {
        props.onclick?.(event)
      }
    })
    // 🆕 Рефка
    .ref((el) => props.ref?.(el))
})

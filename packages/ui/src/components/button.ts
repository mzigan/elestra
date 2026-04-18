import {
  defineComponent,
  button,
  fragment,
  span,
  svg,
  path,
  isGetter,
  type Child,
  type MaybeReactive,
  useEffect,
} from 'elestra'

// ✅ Вынесено за пределы компонента — не пересоздаётся при каждом рендере
function resolve<T>(val: MaybeReactive<T> | undefined, fallback: T): T {
  return isGetter(val) ? val() : (val ?? fallback)
}


function createDefaultSpinner() {
  return svg()
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
      path().attr('d', 'M21 12a9 9 0 1 1-6.219-8.56')
    )
}

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
  attrs?: Record<string, string | boolean>
}

const variants: Record<ButtonVariant, string> = {
  default: 'bg-primary text-primary-foreground hover:bg-primary/90',
  destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
  outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
  ghost: 'hover:bg-accent hover:text-accent-foreground',
  link: 'text-primary underline-offset-4 hover:underline',
}

const sizes: Record<ButtonSize, string> = {
  default: 'h-10 px-4 py-2',
  sm: 'h-9 rounded-md px-3',
  lg: 'h-11 rounded-md px-8',
  icon: 'h-10 w-10',
}

const baseClasses =
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50'

export const Button = defineComponent<ButtonProps>((props) => {

  // ✅ Dev-валидация не вызывает слот во время инициализации —
  //    предупреждение срабатывает при изменении size, а не при создании
  if (process.env.NODE_ENV !== 'production') {
    useEffect(() => {
      const s = resolve(props.size, 'default')
      // Предупреждение сработает не только при создании, 
      // но и если пользователь динамически переключит size на 'icon'
      if (s === 'icon' && props.default) {
        console.warn('Button: size="icon" should not have text content.')
      }
    })
  }

  return button()
    .attr('type', props.type ?? 'button')
    // ✅ disabled — оба условия в одном месте
    .attr('disabled', () => resolve(props.disabled, false) || resolve(props.loading, false))
    // ✅ aria-busy: строка "true"/"false", убирается атрибут только когда false
    .attr('aria-busy', () => resolve(props.loading, false) ? 'true' : null)
    // ✅ aria-label: не перезаписывает, если loading = false
    .attr('aria-label', () => {
      if (!resolve(props.loading, false)) return null
      const content = props.default?.()
      return typeof content === 'string' ? `${content}, loading` : 'Loading, please wait'
    })
    // ✅ attrs: реактивный — применяется в эффекте через .class или отдельный .tap
    //    Защита от перезаписи зарезервированных атрибутов
    .tap((el) => {
      if (!props.attrs) return
      const RESERVED = new Set(['disabled', 'type', 'aria-busy', 'aria-label'])
      for (const [key, value] of Object.entries(props.attrs)) {
        if (RESERVED.has(key)) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn(`Button: attrs["${key}"] conflicts with a built-in attribute and will be ignored.`)
          }
          continue
        }
        if (value === false) {
          el.removeAttribute(key)
        } else {
          el.setAttribute(key, value === true ? '' : value)
        }
      }
    })
    .class(() => {
      const v = resolve(props.variant, 'default')
      const s = resolve(props.size, 'default')
      const isLoading = resolve(props.loading, false)
      const hasIcon = !!(resolve(props.icon, null) || isLoading)
      const userClass = resolve(props.class, '')
      const content = props.default?.()
      const hasGap = s !== 'icon' && hasIcon && !!content

      // ✅ filter(Boolean) убирает двойные пробелы от пустых строк
      return [baseClasses, variants[v], sizes[s], hasGap ? 'gap-2' : '', userClass]
        .filter(Boolean)
        .join(' ')
    })
    .child(() => {
      // ✅ Значения вычисляются один раз внутри эффекта .child()
      const isLoading = resolve(props.loading, false)
      const currentIcon = resolve(props.icon, null)
      const s = resolve(props.size, 'default')
      const content = props.default?.()

      if (isLoading) {
        const spinner = resolve(props.loadingIcon, null) ?? createDefaultSpinner()
        return fragment(
          span()
            .attr('aria-hidden', 'true')
            .class('shrink-0 animate-spin')
            .child(spinner),
          ...(s !== 'icon' && content ? [content] : [])
        )
      }

      if (s === 'icon') {
        return currentIcon ?? content ?? null
      }

      if (!currentIcon && !content) return null

      return fragment(
        ...(currentIcon ? [span().class('shrink-0').child(currentIcon)] : []),
        ...(content ? [content] : [])
      )
    })
    // ✅ Обработчик клика без дублирующей проверки disabled —
    //    браузер и pointer-events-none уже не пропустят событие
    .on('click', (event: MouseEvent) => {
      props.onclick?.(event)
    })
    .ref((el) => props.ref?.(el))
})

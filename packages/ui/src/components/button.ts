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
  if (process.env.NODE_ENV !== 'production') {
    useEffect(() => {
      if (resolve(props.size, 'default') === 'icon' && props.default)
        console.warn('Button: size="icon" should not have text content.')
    })
  }

  return button()
    .attr('type', props.type ?? 'button')
    .attr('disabled', () => resolve(props.disabled, false) || resolve(props.loading, false))
    .attr('aria-busy', () => resolve(props.loading, false) ? 'true' : null)
    .attr('aria-label', () => {
      if (!resolve(props.loading, false)) return null
      const content = props.default?.()
      return typeof content === 'string' ? `${content}, loading` : 'Loading, please wait'
    })
    .spreadAttrs(props.attrs, new Set(['disabled', 'type', 'aria-busy', 'aria-label']))
    .classes(
      baseClasses,
      () => variants[resolve(props.variant, 'default')],
      () => sizes[resolve(props.size, 'default')],
      () => resolve(props.size, 'default') !== 'icon' && (resolve(props.icon, null) || resolve(props.loading, false)) && props.default ? 'gap-2' : '',
      () => resolve(props.class, '')
    )
    .child(() => {
      const s = resolve(props.size, 'default')
      const isLoading = resolve(props.loading, false)
      const content = props.default?.()

      // Если грузимся — берем спиннер, иначе — обычную иконку
      const icon = isLoading
        ? (resolve(props.loadingIcon, null) ?? createDefaultSpinner())
        : resolve(props.icon, null)

      // Квадратная кнопка-иконка
      if (s === 'icon') return icon ?? content ?? null

      // Пустая кнопка
      if (!icon && !content) return null

      // Обертка для иконки/спиннера. Если грузимся — добавляем крутеж и скрываем от скринридеров
      const iconWrapper = isLoading
        ? span().attr('aria-hidden', 'true').classes('shrink-0', 'animate-spin')
        : span().class('shrink-0')

      // Стандартная кнопка
      return fragment(
        ...(icon ? [iconWrapper.child(icon)] : []),
        ...(content ? [content] : [])
      )
    })
    .on('click', (e) => props.onclick?.(e))
    .ref((el) => props.ref?.(el))
})
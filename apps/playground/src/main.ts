import './main.css'
import { createApp, defineComponent, div, span, signal } from 'elestra'
import { Button } from '@elestra/ui'

// 1. Импортируем функцию-конвертер вместе с иконками
import { Mail, LoaderCircle, Trash2, createElement } from 'lucide'

const App = defineComponent(() => {
  const isLoading = signal(true)

  const MailIcon = () => span().child(createElement(Mail))
  const SpinnerIcon = () => span().class('animate-spin').child(createElement(LoaderCircle))

  return div()
    .class('p-8 flex flex-col gap-4 max-w-xs')
    
    // 1. Кнопка с иконкой
    .child(
      Button({
        default: () => span().text('Отправить'),
        // 2. Оборачиваем Mail() в createElement()
        icon: span().child(createElement(Mail))
      })
    )

    // 2. Кнопка-иконка
    .child(
      Button({
        size: 'icon',
        variant: 'outline',
        icon: span().child(createElement(Trash2))
      })
    )

    // 3. Реактивный спиннер
    .child(
      Button({
        variant: 'destructive',
        disabled: () => isLoading(),
        // Геттер вызывает createElement динамически
        loading: isLoading, 
        icon: () => span().child(
          createElement(isLoading() ? LoaderCircle : Trash2)
        ),
        default: () => span().text(isLoading() ? 'Удаление...' : 'Удалить')
      })
    )

    // 4. Кнопка управления
    .child(
      Button({
        variant: 'secondary',
        onclick: () => isLoading.update(v => !v),
        default: () => span().text('Переключить состояние')
      })
    )

    .child(span().class('ml-2 text-xs text-muted-foreground').text('(показать/скрыть спиннер)'))

    .child(
      Button({ 
        icon: MailIcon, 
        loading: isLoading, 
        loadingIcon: SpinnerIcon,
        default: () => 'Login with Email' 
      })
    )

    .child(
      Button({ 
        size: 'icon', 
        icon: MailIcon 
      })      
    )
})

createApp(App).mount('#app')


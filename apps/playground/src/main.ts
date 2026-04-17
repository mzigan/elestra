import './main.css'
import { createApp, defineComponent, div, span, signal } from 'elestra'
import { Button } from '@elestra/ui'

// 1. Импортируем функцию-конвертер вместе с иконками
import { Mail, LoaderCircle, Trash2, createElement } from 'lucide'

const App = defineComponent(() => {
  const isLoading = signal(false)

  return div()
    .class('p-8 flex flex-col gap-4 max-w-xs')
    
    // 1. Кнопка с иконкой
    .child(
      Button({
        default: () => span().text('Отправить'),
        // 2. Оборачиваем Mail() в createElement()
        icon: span().class('w-4 h-4').child(createElement(Mail))
      })
    )

    // 2. Кнопка-иконка
    .child(
      Button({
        size: 'icon',
        variant: 'outline',
        icon: span().class('w-5 h-5').child(createElement(Trash2))
      })
    )

    // 3. Реактивный спиннер
    .child(
      Button({
        variant: 'destructive',
        disabled: () => isLoading(),
        // Геттер вызывает createElement динамически
        icon: () => span().class('w-4 h-4').child(
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
})

createApp(App).mount('#app')


// createApp(App).mount('#app')


// import './main.css'
// import { createApp, defineComponent, div, span } from 'elestra'
// import { Button } from '@elestra/ui'

// const App = defineComponent(() => {
//   return div()
//     .class('p-8 flex flex-col gap-4')
//     .children(
//       // 1. Кнопка из библиотеки (использует токены темы)
//       Button({
//         default: () => span().text('Кнопка с токеном (destructive)'),
//         variant: 'destructive',
//       }),
//       // 2. Обычный элемент со стандартным цветом Tailwind
//       div()
//         .class('bg-red-500 text-white p-4 rounded')
//         .text('Обычный красный (bg-red-500)'),
//       // 3. Еще один стандартный цвет
//       div()
//         .class('bg-emerald-400 text-black p-4 rounded')
//         .text('Обычный зеленый (bg-emerald-400)')
//     )
// })

// createApp(App).mount('#app')


// import './main.css'

// // Больше никаких импортов фреймворков. Только голый DOM.
// const app = document.getElementById('app')!

// app.innerHTML = `
//   <div class="p-8">
//     <p class="text-lg font-bold mb-4">Testing pure Tailwind v4</p>
    
//     <button class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">
//       I am a red button
//     </button>
    
//     <button class="bg-primary text-primary-foreground h-10 px-4 py-2 rounded-md ml-2">
//       I am a dark button
//     </button>
//   </div>`

// import './main.css'
// import { createApp, defineComponent, div, effect, setEffectRunner, span } from 'elestra'
// import { Button } from '@elestra/ui'

// setEffectRunner(effect)

// const App = defineComponent(() => {
//   return div()
//     .class('p-8') // bg-gray-200
//     .children(
//       Button({
//         default: () => span().text('Click me from Monorepo!'),
//         variant: 'outline',
//       })
//     )
//     .children(
//       div().text('Click me from Monorepo!')
//     )
// })

// createApp(App).mount('#app')

import './main.css'
import { createApp, defineComponent, div, span } from 'elestra'
import { Button } from '@elestra/ui'
import '@elestra/ui/styles/theme.css' // Подключили токены!

const App = defineComponent(() => {
  return div()
    .class('p-8')
    .children(
      Button({
        default: () => span().text('Click me from Monorepo!'),
        variant: 'outline',
      })
    )
    .children(
      div().text('Click me from Monorepo!')
    )
})

createApp(App).mount('#app')

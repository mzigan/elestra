import { createApp, defineComponent, div } from 'elestra'
// import { UIButton } from '@elestra/ui'
import '@elestra/ui/styles/theme.css' // Подключили токены!

const App = defineComponent(() => {
  return div()
    .class('p-8')
    // .children(
    //   UIButton({
    //     default: () => span().text('Click me from Monorepo!')
    //   })
    // )
    .children(
      div().text('Click me from Monorepo!')
    )
})

createApp(App).mount('#app')

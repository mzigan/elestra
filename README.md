# elestra

Fine-grained reactive UI framework.  
No VDOM. No JSX. No compiler. Pure TypeScript + `document.createElement`.

Works natively with **Tailwind v4** and **CSS custom properties**.

---

## Install

```bash
npm install elestra
```

Add to your Tailwind v4 stylesheet:

```css
@import "tailwindcss";

@theme {
  --color-primary:   oklch(55% 0.2 250);
  --color-surface:   oklch(98% 0 0);
  --color-on-surface: oklch(20% 0 0);
}
```

## Bootstrap

Import `elestra` once in your entry point — the reactivity layer is wired automatically:

```ts
import 'elestra'
// or
import { createApp } from 'elestra'
```

---

## Core concepts

### Philosophy: Explicit Reactivity
Elestra does not use Proxies. To make a child component react to parent changes, you **must pass a Signal** directly. If you pass a plain value, the child receives a frozen snapshot.

```ts
const count = signal(0)
Child({ count })          // ✅ child reads count() reactively
Child({ count: count() }) // ❌ child gets a frozen number (0)
```

### Philosophy: Two Usage Modes
Elestra doesn't force you to rewrite your entire app. It scales down seamlessly to "Augmented Vanilla" mode. You can use its reactive primitives to enhance plain HTML without defineComponent.

```ts
import { signal } from 'elestra'
import { div, button, For } from 'elestra'

const count = signal(0)
const items = signal(['Apple', 'Banana'])

// No defineComponent, no build step, no context.
// Just reactive DOM building attached to a native element.
const app = div().children(
    button()
        .text(() => `Clicked ${count()} times`)
        .on('click', () => count.update(c => c + 1)),
        
    ul().children(
        For({
            each: () => items(),
            key: item => item,
            render: (item) => li().text(item)
        })
    )
).build()

document.getElementById('app')?.appendChild(app)
```
_Note: In "Vanilla mode", lifecycle hooks (onMount, onDestroy) are not available. Use this for simple widgets, enhancing server-rendered HTML, or prototyping. For scalable applications, use defineComponent._

### Enhancing existing DOM (adopt)
Elestra doesn't require you to render the whole page. You can enhance existing server-rendered or static HTML elements using adopt(). It wraps a native DOM node into an ElementBuilder, giving you access to all reactive methods.

```ts
import { signal } from 'elestra'
import { adopt } from 'elestra'

const query = signal('')

// Take control of an existing input without re-rendering it
adopt<HTMLInputElement>('#search-input')
  .on('input', e => query.set((e.target as HTMLInputElement).value))
  .class('border p-2 rounded')
  .value(() => query()) // Reactive two-way binding!

// Add reactive states to native buttons
adopt('#submit-btn')
  .on('click', () => console.log('Searching:', query()))
  .attr('disabled', () => query() === '') // Button disables when input is empty
```
_Note: adopt() can take either a CSS selector string or a direct DOM node reference. It requires no defineComponent or lifecycle hooks._

### Signals

```ts
import { signal, computed, effect, watch, batch, untrack } from 'elestra'

const count = signal(0)
const double = computed(() => count() * 2)

effect(() => {
  console.log('double is', double())   // runs immediately, re-runs on change
})

count.set(5)          // → "double is 10"
count.update(n => n + 1)

// Multiple writes, one effect flush
batch(() => {
  count.set(0)
  count.set(10)
})

// Watch for changes (old + new value)
watch(() => count(), (next, prev) => {
  console.log(`${prev} → ${next}`)
})

// Read without tracking
const snapshot = untrack(() => count())
```

### Element builder

```ts
import { el, div, button, input, span } from 'elestra'

const name = signal('World')

const card = div()
  .class('flex flex-col gap-4 p-6 rounded-xl')
  .style({ background: 'var(--color-surface)' })
  .children(
    span()
      .class('text-2xl font-semibold')
      .style({ color: 'var(--color-primary)' })
      .text(computed(() => `Hello, ${name()}!`)),

    input()
      .class('border rounded px-3 py-2')
      .attr('placeholder', 'Your name')
      .on('input', e => name.set((e.target as HTMLInputElement).value)),

    button()
      .class('px-4 py-2 rounded-lg text-white')
      .style({ background: 'var(--color-primary)' })
      .classIf('opacity-50', () => name() === '')
      .text('Submit')
      .on('click', () => console.log('Hello,', name())),
  )
  .build()

document.body.appendChild(card)
```

### State Management (Store pattern)
No external state library is needed. Combine `signal`, `computed`, and `injectionKey` to create type-safe, isolated stores.

```ts
import { signal, computed } from 'elestra'
import { injectionKey } from 'elestra'

export const AUTH_STORE_KEY = injectionKey<ReturnType<typeof createAuthStore>>('auth')

export function createAuthStore() {
  const user = signal<{ name: string } | null>(null)
  const isLoggedIn = computed(() => user() !== null)

  function login(name: string) { user.set({ name }) }
  function logout() { user.set(null) }

  return { user, isLoggedIn, login, logout }
}

// --- In main.ts ---
createApp(App).provide(AUTH_STORE_KEY, createAuthStore()).mount('#app')

// --- In component ---
const store = inject(AUTH_STORE_KEY)
store.login('Ivan')
```

### Components

```ts
import {
  defineComponent, onMount, onDestroy, useEffect,
  For, Show, createApp,
} from 'elestra'
import { signal, computed } from 'elestra'
import { div, button, ul, li, span } from 'elestra'

interface Todo {
  id:   number
  text: string
  done: boolean
}

const TodoApp = defineComponent(() => {
  const todos  = signal<Todo[]>([])
  const filter = signal<'all' | 'active' | 'done'>('all')
  let   nextId = 1

  const visible = computed(() =>
    todos().filter(t =>
      filter() === 'all'    ? true  :
      filter() === 'active' ? !t.done :
      t.done
    )
  )

  function addTodo(text: string) {
    todos.update(list => [...list, { id: nextId++, text, done: false }])
  }

  function toggle(id: number) {
    todos.update(list =>
      list.map(t => t.id === id ? { ...t, done: !t.done } : t)
    )
  }

  onMount(() => {
    console.log('TodoApp mounted')
    addTodo('Buy milk')
    addTodo('Ship elestra')
  })

  useEffect(() => {
    document.title = `${todos().filter(t => !t.done).length} tasks left`
  })

  return div()
    .class('max-w-md mx-auto p-8 flex flex-col gap-6')
    .children(
      // Filter tabs
      div().class('flex gap-2').children(
        ...(['all', 'active', 'done'] as const).map(f =>
          button()
            .class('px-3 py-1 rounded-full text-sm')
            .classIf('ring-2', () => filter() === f)
            .style({ background: 'var(--color-surface)' })
            .text(f)
            .on('click', () => filter.set(f))
        )
      ),

      // List with fine-grained updates
      Show({
        when: () => visible().length > 0,
        render: () =>
          ul().class('flex flex-col gap-2').children(
            For({
              each:   visible,
              key:    todo => todo.id,
              // render receives a Signal<Todo>, updating it doesn't re-render the list!
              render: (todoSignal) =>
                li()
                  .class('flex items-center gap-3 p-3 rounded-lg')
                  .style({ background: 'var(--color-surface)' })
                  .on('click', () => toggle(todoSignal().id))
                  .children(
                    span()
                      .class('flex-1')
                      .classIf('line-through opacity-50', () => todoSignal().done)
                      .text(() => todoSignal().text)
                  ),
            })
          ),
        fallback: () =>
          span()
            .class('text-center opacity-50 py-8')
            .text('No tasks here'),
      }),
    )
})

createApp(TodoApp).mount('#app')
```

### Router

```ts
import { createRouter, RouterView, RouterLink, useRoute } from 'elestra'
import { computed } from 'elestra'
import { div, nav, span } from 'elestra'

// ── Pages ──
const Home      = defineComponent(() => div().text('Home'))
const UserPage  = defineComponent((props: { params: { id: string } }) =>
  div().text(computed(() => `User: ${props.params.id}`))
)
const NotFound  = defineComponent(() => div().text('404'))

// ── Router ──
const router = createRouter({
  mode: 'history',
  routes: [
    { path: '/',          component: Home,     name: 'home' },
    { path: '/users/:id', component: UserPage, name: 'user', meta: { requiresAuth: true } },
    { path: '/:path*',    component: NotFound },
  ],
  beforeEach(to) {
    if (to.meta.requiresAuth && !localStorage.getItem('token')) {
      return '/'
    }
  },
})

// ── Root layout ──
const App = defineComponent(() => {
  return div().class('min-h-screen flex flex-col').children(
    nav().class('flex gap-4 p-4 border-b').children(
      RouterLink({
        to:          '/',
        class:       'px-3 py-1 rounded',
        activeClass: 'bg-primary text-white',
        children:    'Home',
      }),
      RouterLink({
        to:          '/users/42',
        class:       'px-3 py-1 rounded',
        activeClass: 'bg-primary text-white',
        children:    'Profile',
      }),
    ),
    div().class('flex-1 p-8').children(RouterView()),
  )
})

createApp(App)
  .use(router)
  .mount('#app')

// Programmatic navigation
router.push('/users/42')
router.push({ name: 'user', params: { id: '99' } })
router.replace({ path: '/', query: { tab: 'active' } })
router.back()
```

---

## API reference

### Reactivity
| | |
|---|---|
| `signal(value)` | Create a reactive value. Read: `s()`. Write: `s.set(v)` / `s.update(fn)`. Peek: `s.peek()` |
| `computed(fn)` | Derived value, lazy, cached. Tracked like a signal |
| `effect(fn)` | Run side-effect, re-run on dependency change. Returns `stop()` |
| `watch(source, cb, opts?)` | Like effect but gets `(newVal, oldVal)`. `{ immediate }` option |
| `batch(fn)` | Group writes — effects flush once after |
| `untrack(fn)` | Read signals without subscribing |

### Element builder
| | |
|---|---|
| `el(tag)` | Generic builder. Also: `div()`, `button()`, `input()`, `textarea()`, `select()`, … |
| `.class(str)` | Add Tailwind classes (diffs them reactively). Reactive if getter passed |
| `.classIf(cls, bool)` | Toggle class conditionally |
| `.style(obj)` | Set CSS properties or custom properties (`--color-*`). Reactive values ok |
| `.cssVar(name, val)` | Shorthand for single `--property` |
| `.attr(name, val)` | Set/remove attribute. Reactive |
| `.aria(name, val)` | Set `aria-*` attribute |
| `.data(obj)` | Set `data-*` attributes |
| `.value(val)` | Set input value (DOM property, not attribute). Reactive |
| `.checked(val)` | Set input checkbox state (DOM property). Reactive |
| `.textValue(val)` | Set textarea value (DOM property). Reactive |
| `.selectValue(val)` | Set select value (DOM property). Reactive |
| `.text(val)` | Set text content. Reactive |
| `.children(...kids)` | Append static children |
| `.child(val)` | Append reactive child slot (swaps component/DOM on change) |
| `.on(event, handler)` | Add event listener (auto-removed on destroy) |
| `.once(event, handler)` | One-time listener |
| `.ref(fn)` | Receive the raw element during build |
| `.tap(fn)` | Imperative setup inline |
| `.build()` | Returns the DOM element |
| `fragment(...kids)` | DocumentFragment, no wrapper |
| `mount(target, el)` | Insert into DOM, returns unmount fn |
| `adopt<T>(node)` | Wrap an existing DOM node into an ElementBuilder (for SSR/vanilla enhancement) |

### Component
| | |
|---|---|
| `defineComponent(setup)` | Define a component. `setup(props)` returns an ElementBuilder or Node |
| `onMount(fn)` | After DOM insertion. Return cleanup fn if needed |
| `onDestroy(fn)` | Before removal |
| `onUpdate(fn)` | When props change |
| `useEffect(fn)` | Scoped reactive effect — auto-disposed on destroy |
| `createEmit(handlers)` | Typed emit function |
| `For({ each, key, render })` | Reactive list. `render` receives `Signal<T>` for fine-grained updates |
| `Show({ when, render, fallback })` | Conditional rendering |
| `inject(key, fallback?)` | DI: read provided value |
| `provideLocal(key, value)` | DI: provide from within a component |
| `injectionKey<T>(desc)` | Create a typed injection key |
| `createApp(root)` | Bootstrap. `.use(plugin)` · `.provide(k, v)` · `.mount(target)` |

### Router
| | |
|---|---|
| `createRouter(opts)` | `{ routes, mode, beforeEach, afterEach }` |
| `router.push(to)` | Navigate (pushState) |
| `router.replace(to)` | Navigate (replaceState) |
| `router.back()` / `.forward()` / `.go(n)` | History traversal |
| `router.resolve(to)` | Resolve without navigating |
| `router.beforeEach(guard)` | Add global guard, returns remove fn |
| `router.afterEach(hook)` | Add after-navigation hook |
| `router.current` | `Signal<RouteLocation>` — reactive current route |
| `RouterView()` | Renders matched component at current depth |
| `RouterLink(props)` | `<a>` with active classes and SPA navigation |
| `useRouter()` | Access router in a component |
| `useRoute()` | `Signal<RouteLocation>` shorthand |

---

## File structure

```
src/
├── index.ts           ← public API (import from here)
├── element-builder.ts ← el(), mount(), destroyNode()
├── reactivity.ts      ← signal, computed, effect, watch, batch
├── component.ts       ← defineComponent, lifecycle, For, Show, createApp
└── router.ts          ← createRouter, RouterView, RouterLink
```

---

## License

MIT

// ─────────────────────────────────────────────────────────────────────────────
// component.ts
// Component system: defineComponent · lifecycle hooks · props · emits
// ─────────────────────────────────────────────────────────────────────────────

import { signal, effect, type Signal } from './reactivity'
import { ElementBuilder, destroyNode, registerDestroyHook } from './element-builder'

// ─── Component context ────────────────────────────────────────────────────────
//
// Each component instance gets a context pushed onto a stack during setup().
// Lifecycle hooks (onMount, onDestroy, …) read from this stack — so they
// can be called anywhere in setup without passing a reference around.
//
// FIX #4: provisions moved into ComponentContext so each component has its own
// scope. inject() walks contextStack upward to find the nearest provider.

interface ComponentContext {
    mountCallbacks: Array<() => void | (() => void)>
    destroyCallbacks: Array<() => void>
    updateCallbacks: Array<() => void>
    effectCleanups: Array<() => void>
    /** Per-component DI provisions (replaces the old global localProvisions map) */
    provisions: Map<InjectionKey<any> | string, unknown>
}

export const contextStack: ComponentContext[] = []

export function getCurrentContext(): ComponentContext | null {
    return contextStack.at(-1) ?? null
}

function createContext(): ComponentContext {
    return {
        mountCallbacks: [],
        destroyCallbacks: [],
        updateCallbacks: [],
        effectCleanups: [],
        provisions: new Map(),
    }
}

// ─── Lifecycle hooks ──────────────────────────────────────────────────────────

/**
 * Run callback after the component's root element is inserted into the DOM.
 * Optionally return a cleanup function — it will be called on destroy.
 *
 * @example
 * onMount(() => {
 *   const timer = setInterval(() => tick.update(n => n + 1), 1000)
 *   return () => clearInterval(timer)
 * })
 */
export function onMount(fn: () => void | (() => void)): void {
    const ctx = getCurrentContext()
    if (!ctx) throw new Error('onMount must be called inside defineComponent setup')
    ctx.mountCallbacks.push(fn)
}

/**
 * Run callback when the component is removed from the DOM.
 *
 * @example
 * onDestroy(() => socket.close())
 */
export function onDestroy(fn: () => void): void {
    const ctx = getCurrentContext()
    if (!ctx) throw new Error('onDestroy must be called inside defineComponent setup')
    ctx.destroyCallbacks.push(fn)
}

/**
 * Run callback whenever props change (after initial render).
 * Note: must be triggered manually via instance._update() from the parent.
 *
 * @example
 * onUpdate(() => console.log('props changed:', props.value))
 */
export function onUpdate(fn: () => void): void {
    const ctx = getCurrentContext()
    if (!ctx) throw new Error('onUpdate must be called inside defineComponent setup')
    ctx.updateCallbacks.push(fn)
}

/**
 * Register a reactive effect scoped to this component's lifetime.
 * Automatically disposed when the component is destroyed.
 *
 * The effect is intentionally deferred until mount so that all signals
 * created during setup() are fully initialised before the effect runs.
 *
 * @example
 * useEffect(() => {
 *   document.title = `Count: ${count()}`
 * })
 */
export function useEffect(fn: () => void): void {
    const ctx = getCurrentContext()
    if (!ctx) throw new Error('useEffect must be called inside defineComponent setup')
    ctx.mountCallbacks.push(() => {
        const cleanup = effect(fn)
        ctx.effectCleanups.push(cleanup)
    })
}

// ─── Props ────────────────────────────────────────────────────────────────────
//
// Props are plain objects. Elestra uses explicit reactivity.
// 
// IMPORTANT: If a parent passes a static value, the child receives a frozen snapshot.
// To make a child component react to parent changes, the parent MUST pass 
// a Signal directly as a prop:
//
//   const count = signal(0)
//   Child({ count })          // ✅ child reads count() reactively
//   Child({ count: count() }) // ❌ child gets a frozen number (0)

export type PropsBase = Record<string, unknown>

// ─── Emits ────────────────────────────────────────────────────────────────────

export type EmitFn<Events extends Record<string, unknown>> = <K extends keyof Events>(
    event: K,
    payload: Events[K],
) => void

/**
 * Create a typed emit function. Pass the handler map from parent props.
 *
 * @example
 * type Events = { select: string; close: void }
 *
 * const Dropdown = defineComponent((props: {
 *   items: string[]
 *   onSelect?: (v: string) => void
 *   onClose?: () => void
 * }) => {
 *   const emit = createEmit<Events>({
 *     select: props.onSelect,
 *     close:  props.onClose,
 *   })
 *   emit('select', item)
 * })
 */
export function createEmit<Events extends Record<string, unknown>>(
    handlers: { [K in keyof Events]?: (payload: Events[K]) => void },
): EmitFn<Events> {
    return (event, payload) => {
        const handler = handlers[event]
        handler?.(payload as any)
    }
}

// ─── Component instance ───────────────────────────────────────────────────────

export interface ComponentInstance {
    /** The root DOM node produced by setup() */
    el: Node
    /** Trigger mount lifecycle (called by mount/render helpers) */
    _mount(): void
    /** Trigger destroy lifecycle (called by destroyNode integration) */
    _destroy(): void
    /** Notify the component that its props have been updated */
    _update(): void
}

// Registry so destroyNode (element-builder) can call _destroy on components
const instanceRegistry = new WeakMap<Node, ComponentInstance>()

export function getComponentInstance(node: Node): ComponentInstance | undefined {
    return instanceRegistry.get(node)
}

// ─── defineComponent ─────────────────────────────────────────────────────────

export type SetupFn<Props extends PropsBase> = (
    props: Props,
) => ElementBuilder<any> | Node

/**
 * Define a reusable component.
 *
 * `setup` is a function that receives props and returns either an
 * `ElementBuilder` or a raw `Node`.
 *
 * Lifecycle hooks (`onMount`, `onDestroy`, `onUpdate`, `useEffect`) called
 * synchronously inside `setup` are automatically wired up.
 *
 * @example
 * const Counter = defineComponent((props: { start?: number }) => {
 *   const count = signal(props.start ?? 0)
 *
 *   onMount(() => console.log('Counter mounted'))
 *   onDestroy(() => console.log('Counter destroyed'))
 *
 *   useEffect(() => {
 *     document.title = `Count: ${count()}`
 *   })
 *
 *   return button()
 *     .text(computed(() => String(count())))
 *     .on('click', () => count.update(n => n + 1))
 * })
 */
export function defineComponent<Props extends PropsBase = {}>(
    setup: SetupFn<Props>,
): (props?: Props) => ComponentInstance {
    return function createInstance(props?: Props): ComponentInstance {
        const ctx = createContext()
        const resolvedProps = (props ?? {}) as Props

        // Run setup with context active
        contextStack.push(ctx)
        let result: ElementBuilder<any> | Node
        try {
            result = setup(resolvedProps)
        } finally {
            contextStack.pop()
        }

        // Resolve to a Node
        const rootNode: Node =
            result instanceof ElementBuilder ? result.build() : result

        const instance: ComponentInstance = {
            el: rootNode,

            _mount() {
                for (const fn of ctx.mountCallbacks) {
                    const cleanup = fn()
                    if (typeof cleanup === 'function') {
                        ctx.destroyCallbacks.push(cleanup)
                    }
                }
            },

            _destroy() {
                // Run effect cleanups first
                for (const fn of ctx.effectCleanups) fn()
                // Then component-level destroy hooks
                for (const fn of ctx.destroyCallbacks) fn()
                ctx.mountCallbacks.length = 0
                ctx.destroyCallbacks.length = 0
                ctx.updateCallbacks.length = 0
                ctx.effectCleanups.length = 0
                ctx.provisions.clear()
            },

            _update() {
                for (const fn of ctx.updateCallbacks) fn()
            },
        }

        instanceRegistry.set(rootNode, instance)
        // FIX: register hook so destroyNode() in element-builder automatically
        // calls _destroy() without a circular import
        registerDestroyHook(rootNode, () => instance._destroy())
        return instance
    }
}

// ─── mountComponent ───────────────────────────────────────────────────────────

/**
 * Mount a component instance into the DOM and trigger its mount lifecycle.
 *
 * @example
 * mountComponent('#app', Counter({ start: 0 }))
 */
export function mountComponent(
    target: string | Element,
    instance: ComponentInstance,
): () => void {
    const container =
        typeof target === 'string' ? document.querySelector(target) : target
    if (!container) throw new Error(`mountComponent: target not found`)

    container.appendChild(instance.el)

    // Trigger mount hooks after insertion (so getBoundingClientRect etc. work)
    instance._mount()

    // Auto-cleanup: observe only direct children of the container,
    // not the entire subtree — avoids performance issues with large trees.
    // FIX: subtree: false — we only care about direct removal from container.
    const observer = new MutationObserver(mutations => {
        for (const mutation of mutations) {
            for (const removed of mutation.removedNodes) {
                if (removed === instance.el) {
                    destroyNode(instance.el)
                    observer.disconnect()
                }
            }
        }
    })

    observer.observe(container, { childList: true, subtree: false })

    return () => {
        destroyNode(instance.el)
        instance.el.parentNode?.removeChild(instance.el)
        observer.disconnect()
    }
}

// ─── createApp ────────────────────────────────────────────────────────────────

export interface App {
    /** Mount the root component to a CSS selector or Element */
    mount(target: string | Element): () => void
    /** Register a plugin (receives the app for extension) */
    use(plugin: Plugin): App
    /** Provide a value globally (accessible via inject() in any component) */
    provide<T>(key: InjectionKey<T> | string, value: T): App
}

export interface Plugin {
    install(app: App): void
}

// ─── provide / inject ─────────────────────────────────────────────────────────
//
// A lightweight DI system.
//
// FIX #4: provideLocal now stores values in the current ComponentContext
// instead of a global map. inject() walks contextStack from top to bottom
// to find the nearest provider, then falls back to globalProvisions.

export type InjectionKey<T> = symbol & { __type: T }

export function injectionKey<T>(description?: string): InjectionKey<T> {
    return Symbol(description) as InjectionKey<T>
}

// Global store for app-level provisions (.provide() on the App)
const globalProvisions = new Map<InjectionKey<any> | string, unknown>()

/**
 * Provide a value from within a component's setup.
 * Available to all descendants via inject().
 *
 * @example
 * provideLocal(THEME_KEY, 'dark')
 */
export function provideLocal<T>(key: InjectionKey<T> | string, value: T): void {
    const ctx = getCurrentContext()
    if (!ctx) throw new Error('provideLocal must be called inside defineComponent setup')
    ctx.provisions.set(key, value)
}

/**
 * Inject a value provided by an ancestor component or the app.
 * Walks up the context stack to find the nearest provider.
 * Throws if the key is not found and no fallback is given.
 *
 * @example
 * const theme = inject(THEME_KEY)
 * const locale = inject('locale', 'en')
 */
export function inject<T>(key: InjectionKey<T> | string): T
export function inject<T>(key: InjectionKey<T> | string, fallback: T): T
export function inject<T>(key: InjectionKey<T> | string, fallback?: T): T {
    // Walk up the context stack from innermost to outermost
    for (let i = contextStack.length - 1; i >= 0; i--) {
        const ctx = contextStack[i]
        if (!ctx) continue
        if (ctx.provisions.has(key)) return ctx.provisions.get(key) as T
    }
    if (globalProvisions.has(key)) return globalProvisions.get(key) as T
    if (fallback !== undefined) return fallback
    throw new Error(`inject: no value provided for key "${String(key)}"`)
}

// ─── createApp ────────────────────────────────────────────────────────────────

/**
 * Bootstrap the application.
 *
 * @example
 * // main.ts
 * import { effect, setEffectRunner } from './reactivity'
 * import { setEffectRunner } from './element-builder'
 *
 * setEffectRunner(effect)   // must be called before any components
 *
 * createApp(RootComponent)
 *   .provide(THEME_KEY, 'dark')
 *   .use(RouterPlugin)
 *   .mount('#app')
 */
export function createApp<Props extends PropsBase = {}>(
    rootComponent: (props?: Props) => ComponentInstance,
    rootProps?: Props,
): App {
    const plugins: Plugin[] = []

    const app: App = {
        mount(target) {
            // Install plugins before mounting
            for (const plugin of plugins) plugin.install(app)

            const instance = rootComponent(rootProps)
            return mountComponent(target, instance)
        },

        use(plugin) {
            plugins.push(plugin)
            return app
        },

        provide(key, value) {
            globalProvisions.set(key as InjectionKey<any>, value)
            return app
        },
    }

    return app
}

// ─── For — reactive list rendering ────────────────────────────────────────────
//
// Renders a list reactively with key-based reconciliation.
// Avoids re-creating DOM nodes for items that haven't changed.
//
// FIX #2: entries.delete() collected into toRemove array, applied after iteration
// FIX #3: effect registered via getCurrentContext so it's cleaned up with the
//         parent component. First render deferred to mount so anchor is in DOM.

/**
 * Render a reactive list with minimal DOM operations.
 * Must be called inside a defineComponent setup().
 *
 * @example
 * const items = signal(['a', 'b', 'c'])
 *
 * For({
 *   each: items,
 *   key: item => item,
 *   render: item => li().class('p-2').text(item),
 * })
 */
export function For<T>({
    each,
    key,
    render,
}: {
    each: () => T[]
    key: (item: T, index: number) => string | number
    render: (item: Signal<T>, index: number) => ElementBuilder<any> | Node | ComponentInstance
}): Node {
    const anchor = document.createComment('For')

    type Entry = {
        node: Node
        instance?: ComponentInstance | undefined
        signal: Signal<T>
    }

    let entries = new Map<string | number, Entry>()

    function runReconcile() {
        if (!anchor.parentNode) return

        const list = each()

        const nextKeys = new Set<string | number>()
        for (let i = 0; i < list.length; i++) {
            nextKeys.add(key(list[i]!, i))
        }

        // Безопасное удаление старых элементов
        const toRemove: Array<string | number> = []
        for (const [k, entry] of entries) {
            if (!nextKeys.has(k)) {
                entry.node.parentNode?.removeChild(entry.node)
                destroyNode(entry.node)
                toRemove.push(k)
            }
        }
        for (const k of toRemove) {
            entries.delete(k)
        }

        // Обновляем или создаем
        let cursor: Node = anchor

        for (let i = 0; i < list.length; i++) {
            const item = list[i]!
            const k = key(item, i)
            let entry = entries.get(k)

            if (!entry) {
                const itemSignal = signal(item)
                const raw = render(itemSignal, i)

                let node: Node
                let compInstance: ComponentInstance | undefined

                if (raw instanceof ElementBuilder) {
                    node = raw.build()
                    compInstance = instanceRegistry.get(node)
                } else if (raw && typeof raw === 'object' && 'el' in raw && '_mount' in raw) {
                    compInstance = raw as ComponentInstance
                    node = compInstance.el
                } else {
                    node = raw as Node
                }

                entry = { node, instance: compInstance, signal: itemSignal }
                entries.set(k, entry);
                (cursor as ChildNode).after(node)
                compInstance?._mount()
            } else {
                // Обновляем данные
                entry.signal.set(item)

                // 🔥 Надежная проверка позиции (совет из ревью, который реально хорош)
                if (entry.node.parentNode !== anchor.parentNode ||
                    entry.node.previousSibling !== cursor) {
                    ; (cursor as ChildNode).after(entry.node)
                }
            }

            cursor = entry.node
        }
    }

    const ctx = getCurrentContext()
    if (ctx) {
        ctx.mountCallbacks.push(() => {
            const cleanup = effect(runReconcile)
            ctx.effectCleanups.push(cleanup)
        })
    } else {
        effect(runReconcile)
    }

    return anchor
}

// ─── Show — conditional rendering ─────────────────────────────────────────────
//
// FIX #3: cleanup registered via parent context (effectCleanups)
// FIX #5: no DocumentFragment — anchor stays the single returned node.
//         Since the effect is deferred to _mount(), anchor is guaranteed
//         to be in a live DOM tree when runEffect() first executes, so
//         anchor.after() is always safe.

/**
 * Conditionally render one of two subtrees based on a reactive condition.
 * Must be called inside a defineComponent setup().
 *
 * @example
 * Show({
 *   when: () => isLoggedIn(),
 *   render: () => Dashboard(),
 *   fallback: () => LoginForm(),
 * })
 */
export function Show({
    when,
    render,
    fallback,
}: {
    when: () => boolean
    render: () => ElementBuilder<any> | ComponentInstance | Node
    fallback?: () => ElementBuilder<any> | ComponentInstance | Node
}): Node {
    const anchor = document.createComment('Show')
    // currentNode starts as anchor itself — no extra placeholder needed
    let currentNode: Node = anchor

    function toNode(result: ElementBuilder<any> | ComponentInstance | Node): {
        node: Node
        instance?: ComponentInstance
    } {
        if (result instanceof ElementBuilder) return { node: result.build() }
        if ('el' in result && '_mount' in result) {
            const ci = result as ComponentInstance
            return { node: ci.el, instance: ci }
        }
        return { node: result as Node }
    }

    function swap(next: Node | null, instance?: ComponentInstance) {
        if (next === currentNode) return

        // Сначала удаляем старый узел из DOM
        if (currentNode !== anchor && currentNode.parentNode) {
            currentNode.parentNode.removeChild(currentNode)
        }

        // Потом уничтожаем (хуки _destroy видят, что узел ещё в DOM? 
        // Нет, но они могут работать с detached узлом)
        if (currentNode !== anchor) {
            destroyNode(currentNode)
        }

        if (!next) {
            currentNode = anchor
            return
        }

        if (currentNode === anchor) {
            anchor.after(next)
        } else if (anchor.parentNode) {
            // Вставляем на место удалённого узла (после anchor)
            anchor.parentNode.insertBefore(next, anchor.nextSibling)
        }

        currentNode = next
        instance?._mount()
    }

    function runEffect() {
        if (!anchor.parentNode) return

        const show = when()
        const raw = show ? render() : fallback?.()

        if (!raw) {
            swap(null)
            return
        }

        const { node, instance } = toNode(raw)
        swap(node, instance)
    }

    // FIX #3: register through parent context for proper cleanup
    const ctx = getCurrentContext()
    if (ctx) {
        const safeCtx = ctx
        safeCtx.mountCallbacks.push(() => {
            const cleanup = effect(runEffect)
            safeCtx.effectCleanups.push(cleanup)
        })
    } else {
        effect(runEffect)
    }

    // Return only the anchor — no fragment, no detach issues
    return anchor
}

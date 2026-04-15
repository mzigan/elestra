// ─────────────────────────────────────────────────────────────────────────────
// element-builder.ts
// Core DOM builder. No dependencies, no VDOM.
// Works with Tailwind v4 classes and CSS custom properties.
// ─────────────────────────────────────────────────────────────────────────────

import { getCurrentContext, type ComponentInstance } from "./component"

// ─── Types ───────────────────────────────────────────────────────────────────

/** Anything that can be a child of an element */
export type Child =
    | ElementBuilder<any>
    | Node
    | string
    | number
    | null
    | undefined
    | false
    | ComponentInstance

/** A reactive getter — e.g. computed(() => count()) */
export type Getter<T> = () => T

/** A value or a reactive getter for that value */
export type MaybeReactive<T> = T | Getter<T>

/** Style object — values can be reactive */
export type StyleInput = {
    [K in keyof CSSStyleDeclaration]?: MaybeReactive<string>
}

/** Dataset values */
export type DatasetInput = Record<string, MaybeReactive<string>>

/** Generic event handler map */
export type EventMap = {
    [K in keyof HTMLElementEventMap]?: (e: HTMLElementEventMap[K]) => void
}

// ─── Effect registration (injected by reactivity layer) ─────────────────────
//
// The builder itself has zero knowledge of signals. Instead, callers can
// register a global "effect runner" so that reactive bindings work when
// MaybeReactive<T> values are passed.
//
// Call `setEffectRunner(effect)` once during app bootstrap:
//   import { effect } from './reactivity'
//   import { setEffectRunner } from './element-builder'
//   setEffectRunner(effect)

type EffectRunner = (fn: () => void) => () => void   // returns cleanup
let _effectRunner: EffectRunner | null = null

export function setEffectRunner(runner: EffectRunner, force = false): void {
    if (_effectRunner && !force) return
    _effectRunner = runner
}

function runEffect(fn: () => void): (() => void) | undefined {
    return _effectRunner ? _effectRunner(fn) : undefined
}

// ─── Destroy hooks ────────────────────────────────────────────────────────────
//
// component.ts registers a hook per root node so that destroyNode()
// automatically calls instance._destroy() without creating a circular import.
//
// Usage (in component.ts):
//   registerDestroyHook(rootNode, () => instance._destroy())

type DestroyHook = () => void
const destroyHooks = new WeakMap<Node, DestroyHook>()

export function registerDestroyHook(node: Node, fn: DestroyHook): void {
    destroyHooks.set(node, fn)
}

// ─── Cleanup registry ────────────────────────────────────────────────────────
//
// Each builder tracks cleanup functions (reactive subscriptions, event listeners).
// Call builder.destroy() to release them, or use the MutationObserver-based
// auto-cleanup by mounting via mount().

const cleanupRegistry = new WeakMap<Node, Array<() => void>>()

function addCleanup(node: Node, fn: () => void): void {
    const list = cleanupRegistry.get(node) ?? []
    list.push(fn)
    cleanupRegistry.set(node, list)
}

export function destroyNode(node: Node): void {
    // FIX: call component _destroy() hook if registered (avoids circular import)
    destroyHooks.get(node)?.()
    destroyHooks.delete(node)

    const cleanups = cleanupRegistry.get(node)
    if (cleanups) {
        cleanups.forEach(fn => fn())
        cleanupRegistry.delete(node)
    }
    node.childNodes.forEach(destroyNode)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isGetter<T>(v: MaybeReactive<T>): v is Getter<T> {
    return typeof v === 'function'
}

// Тип-защитник (Type Guard) для интерфейса ComponentInstance
function isComponentInstance(val: unknown): val is ComponentInstance {
    return typeof val === 'object' && val !== null &&
        'el' in val && '_mount' in val && '_destroy' in val && '_update' in val
}

function resolveChild(child: Child): Node {
    // 1. Билдеры
    if (child instanceof ElementBuilder) return child.build()

    // 2. Компоненты (Просто возвращаем корень, НЕ трогаем _mount!)
    if (isComponentInstance(child)) {
        return child.el
    }

    // 3. Обычные ноды
    if (child instanceof Node) return child

    // 4. Примитивы и пустота
    if (child === null || child === undefined || child === false) {
        return document.createComment('')
    }

    return document.createTextNode(String(child))
}

// ─── ElementBuilder ───────────────────────────────────────────────────────────

export class ElementBuilder<T extends HTMLElement = HTMLElement> {
    private _el: T
    private _cleanups: Array<() => void> = []

    constructor(tag: string) {
        this._el = document.createElement(tag) as T
    }

    // ─── Classes (Tailwind v4 utilities) ────────────────────────────────────

    /** Add static or reactive Tailwind classes */
    class(value: MaybeReactive<string>): this {
        if (isGetter(value)) {
            let prevSet = new Set<string>()
            const cleanup = runEffect(() => {
                const next = value()
                const nextSet = new Set(next.split(/\s+/).filter(Boolean))
                for (const cls of prevSet) {
                    if (!nextSet.has(cls)) this._el.classList.remove(cls)
                }
                for (const cls of nextSet) {
                    if (!prevSet.has(cls)) this._el.classList.add(cls)
                }
                prevSet = nextSet
            })
            if (cleanup) this._cleanups.push(cleanup)
        } else {
            this._el.classList.add(...value.split(/\s+/).filter(Boolean))
        }
        return this
    }

    /** Toggle a class conditionally (reactive or static) */
    classIf(cls: string, condition: MaybeReactive<boolean>): this {
        if (isGetter(condition)) {
            const cleanup = runEffect(() => {
                this._el.classList.toggle(cls, condition())
            })
            if (cleanup) this._cleanups.push(cleanup)
        } else {
            this._el.classList.toggle(cls, condition)
        }
        return this
    }

    // ─── Inline styles (CSS custom properties) ──────────────────────────────

    /**
     * Set one or more style properties. Values can be reactive.
     * Passing an empty string removes the property.
     *
     * @example
     * el('div').style({ color: 'var(--color-primary)' })
     * el('div').style({ opacity: computed(() => active() ? '1' : '0.5') })
     */
    style(styles: StyleInput): this {
        const apply = (prop: string, resolved: string) => {
            if (resolved === '' || (resolved as any) === null) {
                if (prop.startsWith('--')) {
                    this._el.style.removeProperty(prop)
                } else {
                    (this._el.style as any)[prop] = ''
                    this._el.style.removeProperty(prop)
                }
            } else {
                if (prop.startsWith('--')) {
                    this._el.style.setProperty(prop, resolved)
                } else {
                    (this._el.style as any)[prop] = resolved
                }
            }
        }

        for (const [prop, value] of Object.entries(styles) as [string, MaybeReactive<string>][]) {
            if (isGetter(value)) {
                const cleanup = runEffect(() => apply(prop, value()))
                if (cleanup) this._cleanups.push(cleanup)
            } else {
                apply(prop, value)
            }
        }
        return this
    }

    /**
     * Set a single CSS custom property.
     *
     * @example
     * el('div').cssVar('--color-accent', signal('#ff0000'))
     */
    cssVar(name: `--${string}`, value: MaybeReactive<string>): this {
        return this.style({ [name]: value } as StyleInput)
    }

    // ─── Attributes ──────────────────────────────────────────────────────────

    /** Set an HTML attribute (static or reactive) */
    attr(name: string, value: MaybeReactive<string | boolean | null>): this {
        const apply = (v: string | boolean | null) => {
            if (v === null || v === false) {
                this._el.removeAttribute(name)
            } else if (v === true) {
                this._el.setAttribute(name, '')
            } else {
                this._el.setAttribute(name, v)
            }
        }

        if (isGetter(value)) {
            const cleanup = runEffect(() => apply(value()))
            if (cleanup) this._cleanups.push(cleanup)
        } else {
            apply(value)
        }
        return this
    }

    /** Shorthand: id attribute */
    id(value: string): this {
        return this.attr('id', value)
    }

    /** Shorthand: aria-* attributes */
    aria(name: string, value: MaybeReactive<string | boolean | null>): this {
        return this.attr(`aria-${name}`, value)
    }

    /** Shorthand: data-* attributes */
    data(dataset: DatasetInput): this {
        for (const [key, value] of Object.entries(dataset)) {
            this.attr(`data-${key}`, value)
        }
        return this
    }

    // ─── Values ──────────────────────────────────────────────────────────

    /** Set an value (static or reactive) */
    value(val: MaybeReactive<string | number>): this {
        const apply = (v: string | number) => {
            if (this._el instanceof HTMLInputElement) {
                this._el.value = String(v)
            } else {
                console.warn('.value() can only be used on input elements')
            }
        }

        if (isGetter(val)) {
            const cleanup = runEffect(() => apply(val()))
            if (cleanup) this._cleanups.push(cleanup)
        } else {
            apply(val)
        }
        return this
    }

    checked(val: MaybeReactive<boolean>): this {
        const apply = (v: boolean) => {
            if (this._el instanceof HTMLInputElement) {
                this._el.checked = v
            } else {
                console.warn('.checked() can only be used on input elements')
            }
        }

        if (isGetter(val)) {
            const cleanup = runEffect(() => apply(val()))
            if (cleanup) this._cleanups.push(cleanup)
        } else {
            apply(val)
        }
        return this
    }

    textValue(val: MaybeReactive<string>): this {
        const apply = (v: string) => {
            if (this._el instanceof HTMLTextAreaElement) {
                this._el.value = v
            } else {
                console.warn('.textValue() can only be used on textarea elements')
            }
        }

        if (isGetter(val)) {
            const cleanup = runEffect(() => apply(val()))
            if (cleanup) this._cleanups.push(cleanup)
        } else {
            apply(val)
        }
        return this
    }

    selectValue(val: MaybeReactive<string>): this {
        const apply = (v: string) => {
            if (this._el instanceof HTMLSelectElement) {
                this._el.value = v
            } else {
                console.warn('.selectValue() can only be used on select elements')
            }
        }

        if (isGetter(val)) {
            const cleanup = runEffect(() => apply(val()))
            if (cleanup) this._cleanups.push(cleanup)
        } else {
            apply(val)
        }
        return this
    }

    // ─── Text content ────────────────────────────────────────────────────────

    /**
     * Set text content (reactive or static).
     * Replaces all children with a single TextNode.
     * FIX: destroyNode called on existing children before replacing,
     * preventing memory leaks if children include components.
     *
     * @example
     * el('span').text(computed(() => `Count: ${count()}`))
     */
    text(value: MaybeReactive<string | number>): this {
        // FIX: cleanup existing children before wiping them
        this._el.childNodes.forEach(destroyNode)
        const node = document.createTextNode('')
        this._el.replaceChildren(node)

        if (isGetter(value)) {
            const cleanup = runEffect(() => {
                node.textContent = String(value())
            })
            if (cleanup) this._cleanups.push(cleanup)
        } else {
            node.textContent = String(value)
        }
        return this
    }

    // ─── Children ────────────────────────────────────────────────────────────

    /**
     * Append static children. For dynamic lists use the dedicated `For` helper.
     */
    children(...kids: Child[]): this {
        for (const child of kids) {
            const node = resolveChild(child)
            this._el.appendChild(node)

            // 🔥 FIX: Управляем жизненным циклом только после вставки в DOM
            if (isComponentInstance(child)) {
                const ctx = getCurrentContext()
                if (ctx) {
                    // Если мы внутри компонента — откладываем маунт дочернего компонента.
                    // Он вызовется, когда текущий (родительский) компонент будет смонтирован в DOM.
                    ctx.mountCallbacks.push(() => child._mount())
                }
                // Если ctx нет (вызвали вне defineComponent), мы не знаем, когда узел попадет в DOM.
                // Поэтому мы НЕ вызываем queueMicrotask, чтобы избежать бага с "плавающим" onMount.
                // Пользователь должен использовать mountComponent() для корневых компонентов.
            }
        }
        return this
    }

    /**
     * Append a reactive child slot. When the getter re-runs, the old subtree
     * is destroyed and the new one is inserted in its place.
     *
     * FIX: currentNode starts as anchor (not a detached comment), so the first
     * swap via anchor.after() is always safe — even before the element is in DOM
     * the anchor is at least inside this._el which is a valid parent.
     *
     * @example
     * el('div').child(computed(() => isOpen() ? Modal() : null))
     */
    child(value: MaybeReactive<Child>): this {
        const anchor = document.createComment('child')
        this._el.appendChild(anchor)

        if (isGetter(value)) {
            let currentNode: Node = anchor

            const cleanup = runEffect(() => {
                const raw = value()

                // 🔥 FIX: Не превращаем null/false в узел, а оставляем null
                const next = raw ? resolveChild(raw) : null

                if (next === currentNode) return

                if (currentNode !== anchor) {
                    destroyNode(currentNode)
                }

                if (next) {
                    if (currentNode === anchor) {
                        anchor.after(next)
                    } else if (currentNode.parentNode) {
                        currentNode.parentNode.replaceChild(next, currentNode)
                    }

                    // 🔥 FIX: Маунтим компонент, если он был отрендерен реактивно
                    if (isComponentInstance(raw)) {
                        const ctx = getCurrentContext()
                        if (ctx) {
                            ctx.mountCallbacks.push(() => raw._mount())
                        }
                    }

                    currentNode = next
                } else {
                    // Если null, просто возвращаемся к anchor (DOM пуст)
                    currentNode = anchor
                }
            })

            if (cleanup) this._cleanups.push(cleanup)
        } else {
            const node = value ? resolveChild(value) : null
            if (node) anchor.after(node)
        }
        return this
    }

    // ─── Events ──────────────────────────────────────────────────────────────

    /**
     * Add an event listener. Automatically cleaned up on destroy().
     *
     * @example
     * el('button').on('click', () => count.set(count() + 1))
     */
    on<K extends keyof HTMLElementEventMap>(
        event: K,
        handler: (e: HTMLElementEventMap[K]) => void,
        options?: AddEventListenerOptions,
    ): this {
        this._el.addEventListener(event, handler as EventListener, options)
        this._cleanups.push(() =>
            this._el.removeEventListener(event, handler as EventListener, options),
        )
        return this
    }

    /**
     * Add a one-time event listener.
     */
    once<K extends keyof HTMLElementEventMap>(
        event: K,
        handler: (e: HTMLElementEventMap[K]) => void,
    ): this {
        return this.on(event, handler, { once: true })
    }

    // ─── Refs ────────────────────────────────────────────────────────────────

    /**
     * Get a reference to the underlying DOM element during build.
     *
     * @example
     * let inputEl: HTMLInputElement
     * el('input').ref(el => (inputEl = el))
     */
    ref(fn: (el: T) => void): this {
        fn(this._el)
        return this
    }

    // ─── Lifecycle helpers ───────────────────────────────────────────────────

    /**
     * Run a callback immediately (useful for imperative setup).
     */
    tap(fn: (el: T) => void): this {
        fn(this._el)
        return this
    }

    // ─── Build ───────────────────────────────────────────────────────────────

    /**
     * Finalise and return the DOM element.
     * Registers all accumulated cleanups on the node.
     */
    build(): T {
        for (const cleanup of this._cleanups) {
            addCleanup(this._el, cleanup)
        }
        this._cleanups = []
        return this._el
    }

    /**
     * Destroy the element — runs all cleanup functions
     * (reactive subscriptions, event listeners).
     */
    destroy(): void {
        destroyNode(this._el)
    }
}

// ─── Factory functions ────────────────────────────────────────────────────────

/**
 * Create an ElementBuilder for any HTML tag.
 *
 * @example
 * el('div').class('flex gap-4').children(el('span').text('Hi')).build()
 */
export function el(tag: string): ElementBuilder {
    return new ElementBuilder(tag)
}

/**
 * Typed shorthands for common elements.
 */
export const div = () => new ElementBuilder<HTMLDivElement>('div')
export const span = () => new ElementBuilder<HTMLSpanElement>('span')
export const p = () => new ElementBuilder<HTMLParagraphElement>('p')
export const h1 = () => new ElementBuilder<HTMLHeadingElement>('h1')
export const h2 = () => new ElementBuilder<HTMLHeadingElement>('h2')
export const h3 = () => new ElementBuilder<HTMLHeadingElement>('h3')
export const button = () => new ElementBuilder<HTMLButtonElement>('button')
export const input = () => new ElementBuilder<HTMLInputElement>('input')
export const form = () => new ElementBuilder<HTMLFormElement>('form')
export const img = () => new ElementBuilder<HTMLImageElement>('img')
export const a = () => new ElementBuilder<HTMLAnchorElement>('a')
export const ul = () => new ElementBuilder<HTMLUListElement>('ul')
export const li = () => new ElementBuilder<HTMLLIElement>('li')
export const section = () => new ElementBuilder<HTMLElement>('section')
export const article = () => new ElementBuilder<HTMLElement>('article')
export const header = () => new ElementBuilder<HTMLElement>('header')
export const footer = () => new ElementBuilder<HTMLElement>('footer')
export const nav = () => new ElementBuilder<HTMLElement>('nav')
export const main = () => new ElementBuilder<HTMLElement>('main')
export const label = () => new ElementBuilder<HTMLLabelElement>('label')
export const select = () => new ElementBuilder<HTMLSelectElement>('select')
export const option = () => new ElementBuilder<HTMLOptionElement>('option')
export const textarea = () => new ElementBuilder<HTMLTextAreaElement>('textarea')

/**
 * Create a DocumentFragment from children (no wrapper element).
 *
 * @example
 * fragment(el('dt').text('Key'), el('dd').text('Value'))
 */
export function fragment(...kids: Child[]): DocumentFragment {
    const frag = document.createDocumentFragment()
    for (const child of kids) {
        const node = resolveChild(child)
        frag.appendChild(node)

        if (isComponentInstance(child)) {
            const ctx = getCurrentContext()
            if (ctx) {
                ctx.mountCallbacks.push(() => child._mount())
            }
        }
    }
    return frag
}

// ─── Mount ───────────────────────────────────────────────────────────────────

/**
 * Mount a built element (or builder) into a container.
 * Automatically destroys the node when it's removed from the DOM.
 *
 * For component instances prefer mountComponent() from component.ts —
 * it also triggers lifecycle hooks (_mount/_destroy).
 *
 * FIX: subtree: false — observer only watches direct children of container,
 * not the entire app tree, avoiding performance issues at scale.
 *
 * @example
 * mount('#app', el('div').text('Hello'))
 */
export function mount(
    target: string | Element,
    child: ElementBuilder | Node,
): () => void {
    const container =
        typeof target === 'string' ? document.querySelector(target) : target

    if (!container) throw new Error(`mount: target "${target}" not found`)

    const node = child instanceof ElementBuilder ? child.build() : child
    container.appendChild(node)

    // FIX: subtree: false — only watch direct removal from container
    const observer = new MutationObserver(mutations => {
        for (const mutation of mutations) {
            for (const removed of mutation.removedNodes) {
                if (removed === node) {
                    destroyNode(node)
                    observer.disconnect()
                }
            }
        }
    })
    observer.observe(container, { childList: true, subtree: false })

    return () => {
        destroyNode(node)
        node.parentNode?.removeChild(node)
        observer.disconnect()
    }
}

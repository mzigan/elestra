/** Anything that can be a child of an element */
type Child = ElementBuilder<any> | Node | string | number | null | undefined | false;
/** A reactive getter — e.g. computed(() => count()) */
type Getter<T> = () => T;
/** A value or a reactive getter for that value */
type MaybeReactive<T> = T | Getter<T>;
/** Style object — values can be reactive */
type StyleInput = {
    [K in keyof CSSStyleDeclaration]?: MaybeReactive<string>;
};
/** Dataset values */
type DatasetInput = Record<string, MaybeReactive<string>>;
/** Generic event handler map */
type EventMap = {
    [K in keyof HTMLElementEventMap]?: (e: HTMLElementEventMap[K]) => void;
};
type EffectRunner = (fn: () => void) => () => void;
declare function setEffectRunner(runner: EffectRunner): void;
declare function destroyNode(node: Node): void;
declare class ElementBuilder<T extends HTMLElement = HTMLElement> {
    private _el;
    private _cleanups;
    constructor(tag: string);
    /** Add static or reactive Tailwind classes */
    class(value: MaybeReactive<string>): this;
    /** Toggle a class conditionally (reactive or static) */
    classIf(cls: string, condition: MaybeReactive<boolean>): this;
    /**
     * Set one or more style properties. Values can be reactive.
     * Passing an empty string removes the property.
     *
     * @example
     * el('div').style({ color: 'var(--color-primary)' })
     * el('div').style({ opacity: computed(() => active() ? '1' : '0.5') })
     */
    style(styles: StyleInput): this;
    /**
     * Set a single CSS custom property.
     *
     * @example
     * el('div').cssVar('--color-accent', signal('#ff0000'))
     */
    cssVar(name: `--${string}`, value: MaybeReactive<string>): this;
    /** Set an HTML attribute (static or reactive) */
    attr(name: string, value: MaybeReactive<string | boolean | null>): this;
    /** Shorthand: id attribute */
    id(value: string): this;
    /** Shorthand: aria-* attributes */
    aria(name: string, value: MaybeReactive<string | boolean | null>): this;
    /** Shorthand: data-* attributes */
    data(dataset: DatasetInput): this;
    /**
     * Set text content (reactive or static).
     * Replaces all children with a single TextNode.
     * FIX: destroyNode called on existing children before replacing,
     * preventing memory leaks if children include components.
     *
     * @example
     * el('span').text(computed(() => `Count: ${count()}`))
     */
    text(value: MaybeReactive<string | number>): this;
    /**
     * Append static children. For dynamic lists use the dedicated `For` helper.
     */
    children(...kids: Child[]): this;
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
    child(value: MaybeReactive<Child>): this;
    /**
     * Add an event listener. Automatically cleaned up on destroy().
     *
     * @example
     * el('button').on('click', () => count.set(count() + 1))
     */
    on<K extends keyof HTMLElementEventMap>(event: K, handler: (e: HTMLElementEventMap[K]) => void, options?: AddEventListenerOptions): this;
    /**
     * Add a one-time event listener.
     */
    once<K extends keyof HTMLElementEventMap>(event: K, handler: (e: HTMLElementEventMap[K]) => void): this;
    /**
     * Get a reference to the underlying DOM element during build.
     *
     * @example
     * let inputEl: HTMLInputElement
     * el('input').ref(el => (inputEl = el))
     */
    ref(fn: (el: T) => void): this;
    /**
     * Run a callback immediately (useful for imperative setup).
     */
    tap(fn: (el: T) => void): this;
    /**
     * Finalise and return the DOM element.
     * Registers all accumulated cleanups on the node.
     */
    build(): T;
    /**
     * Destroy the element — runs all cleanup functions
     * (reactive subscriptions, event listeners).
     */
    destroy(): void;
}
/**
 * Create an ElementBuilder for any HTML tag.
 *
 * @example
 * el('div').class('flex gap-4').children(el('span').text('Hi')).build()
 */
declare function el(tag: string): ElementBuilder;
/**
 * Typed shorthands for common elements.
 */
declare const div: () => ElementBuilder<HTMLDivElement>;
declare const span: () => ElementBuilder<HTMLSpanElement>;
declare const p: () => ElementBuilder<HTMLParagraphElement>;
declare const h1: () => ElementBuilder<HTMLHeadingElement>;
declare const h2: () => ElementBuilder<HTMLHeadingElement>;
declare const h3: () => ElementBuilder<HTMLHeadingElement>;
declare const button: () => ElementBuilder<HTMLButtonElement>;
declare const input: () => ElementBuilder<HTMLInputElement>;
declare const form: () => ElementBuilder<HTMLFormElement>;
declare const img: () => ElementBuilder<HTMLImageElement>;
declare const a: () => ElementBuilder<HTMLAnchorElement>;
declare const ul: () => ElementBuilder<HTMLUListElement>;
declare const li: () => ElementBuilder<HTMLLIElement>;
declare const section: () => ElementBuilder<HTMLElement>;
declare const article: () => ElementBuilder<HTMLElement>;
declare const header: () => ElementBuilder<HTMLElement>;
declare const footer: () => ElementBuilder<HTMLElement>;
declare const nav: () => ElementBuilder<HTMLElement>;
declare const main: () => ElementBuilder<HTMLElement>;
declare const label: () => ElementBuilder<HTMLLabelElement>;
declare const select: () => ElementBuilder<HTMLSelectElement>;
declare const option: () => ElementBuilder<HTMLOptionElement>;
declare const textarea: () => ElementBuilder<HTMLTextAreaElement>;
/**
 * Create a DocumentFragment from children (no wrapper element).
 *
 * @example
 * fragment(el('dt').text('Key'), el('dd').text('Value'))
 */
declare function fragment(...kids: Child[]): DocumentFragment;
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
declare function mount(target: string | Element, child: ElementBuilder | Node): () => void;

interface Signal<T> {
    (): T;
    set(value: T): void;
    update(fn: (prev: T) => T): void;
    peek(): T;
}
declare function signal<T>(initialValue: T): Signal<T>;
declare function effect(fn: () => void): () => void;
interface Computed<T> {
    (): T;
    dispose(): void;
}
declare function computed<T>(fn: () => T): Computed<T>;
interface WatchOptions {
    immediate?: boolean;
}
declare function watch<T>(source: () => T, callback: (newValue: T, oldValue: T | undefined) => void, options?: WatchOptions): () => void;
declare function batch(fn: () => void): void;
declare function untrack<T>(fn: () => T): T;

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
declare function onMount(fn: () => void | (() => void)): void;
/**
 * Run callback when the component is removed from the DOM.
 *
 * @example
 * onDestroy(() => socket.close())
 */
declare function onDestroy(fn: () => void): void;
/**
 * Run callback whenever props change (after initial render).
 * Note: must be triggered manually via instance._update() from the parent.
 *
 * @example
 * onUpdate(() => console.log('props changed:', props.value))
 */
declare function onUpdate(fn: () => void): void;
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
declare function useEffect(fn: () => void): void;
type PropsBase = Record<string, unknown>;
/**
 * Convert a plain props object into a record of signals (snapshot).
 * Use when you need to read props reactively inside computed/effect,
 * but only when the parent won't change those values after mount.
 * For truly reactive props, pass Signal values directly.
 *
 * @example
 * const MyComp = defineComponent((rawProps: { label: string }) => {
 *   const props = toSignals(rawProps)
 *   const upper = computed(() => props.label().toUpperCase())
 *   return el('span').text(upper).build()
 * })
 */
declare function toSignals<T extends PropsBase>(props: T): {
    [K in keyof T]: Signal<T[K]>;
};
type EmitFn<Events extends Record<string, unknown>> = <K extends keyof Events>(event: K, payload: Events[K]) => void;
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
declare function createEmit<Events extends Record<string, unknown>>(handlers: {
    [K in keyof Events]?: (payload: Events[K]) => void;
}): EmitFn<Events>;
interface ComponentInstance {
    /** The root DOM node produced by setup() */
    el: Node;
    /** Trigger mount lifecycle (called by mount/render helpers) */
    _mount(): void;
    /** Trigger destroy lifecycle (called by destroyNode integration) */
    _destroy(): void;
    /** Notify the component that its props have been updated */
    _update(): void;
}
declare function getComponentInstance(node: Node): ComponentInstance | undefined;
type SetupFn<Props extends PropsBase> = (props: Props) => ElementBuilder<any> | Node;
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
declare function defineComponent<Props extends PropsBase = {}>(setup: SetupFn<Props>): (props?: Props) => ComponentInstance;
/**
 * Mount a component instance into the DOM and trigger its mount lifecycle.
 *
 * @example
 * mountComponent('#app', Counter({ start: 0 }))
 */
declare function mountComponent(target: string | Element, instance: ComponentInstance): () => void;
interface App {
    /** Mount the root component to a CSS selector or Element */
    mount(target: string | Element): () => void;
    /** Register a plugin (receives the app for extension) */
    use(plugin: Plugin): App;
    /** Provide a value globally (accessible via inject() in any component) */
    provide<T>(key: InjectionKey<T> | string, value: T): App;
}
interface Plugin {
    install(app: App): void;
}
type InjectionKey<T> = symbol & {
    __type: T;
};
declare function injectionKey<T>(description?: string): InjectionKey<T>;
/**
 * Provide a value from within a component's setup.
 * Available to all descendants via inject().
 *
 * @example
 * provideLocal(THEME_KEY, 'dark')
 */
declare function provideLocal<T>(key: InjectionKey<T> | string, value: T): void;
/**
 * Inject a value provided by an ancestor component or the app.
 * Walks up the context stack to find the nearest provider.
 * Throws if the key is not found and no fallback is given.
 *
 * @example
 * const theme = inject(THEME_KEY)
 * const locale = inject('locale', 'en')
 */
declare function inject<T>(key: InjectionKey<T> | string): T;
declare function inject<T>(key: InjectionKey<T> | string, fallback: T): T;
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
declare function createApp<Props extends PropsBase = {}>(rootComponent: (props?: Props) => ComponentInstance, rootProps?: Props): App;
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
declare function For<T>({ each, key, render, }: {
    each: () => T[];
    key: (item: T, index: number) => string | number;
    render: (item: T, index: number) => ElementBuilder<any> | Node;
}): Node;
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
declare function Show({ when, render, fallback, }: {
    when: () => boolean;
    render: () => ElementBuilder<any> | ComponentInstance | Node;
    fallback?: () => ElementBuilder<any> | ComponentInstance | Node;
}): Node;

type RouteParams = Record<string, string>;
type RouteQuery = Record<string, string>;
/** A resolved location — what the router knows about the current URL */
interface RouteLocation {
    path: string;
    params: RouteParams;
    query: RouteQuery;
    hash: string;
    /** Full matched route definition chain (parent → child) */
    matched: RouteRecord[];
    /** Arbitrary metadata attached to the route definition */
    meta: RouteMeta;
}
type RouteMeta = Record<string, unknown>;
/** One entry in the route config */
interface RouteRecord {
    path: string;
    /** Component factory — receives params & returns a ComponentInstance */
    component?: (props?: any) => ComponentInstance;
    /** Nested routes */
    children?: RouteRecord[];
    meta?: RouteMeta;
    /** Redirect to another path (string or function) */
    redirect?: string | ((to: RouteLocation) => string);
    /** Route-level guard — return false or a path string to block/redirect */
    beforeEnter?: NavigationGuard;
    /** Name for programmatic navigation */
    name?: string;
}
type NavigationGuard = (to: RouteLocation, from: RouteLocation | null) => boolean | string | void | Promise<boolean | string | void>;
/** What you pass to router.push / router.replace */
type RawLocation = string | {
    path: string;
    query?: RouteQuery;
    hash?: string;
} | {
    name: string;
    params?: RouteParams;
    query?: RouteQuery;
    hash?: string;
};
declare const ROUTER_KEY: InjectionKey<Router>;
interface RouterOptions {
    routes: RouteRecord[];
    mode?: 'hash' | 'history';
    /** Global navigation guard */
    beforeEach?: NavigationGuard;
    /** Called after every successful navigation */
    afterEach?: (to: RouteLocation, from: RouteLocation | null) => void;
}
interface Router {
    /** Current resolved route (reactive signal) */
    readonly current: Signal<RouteLocation>;
    /** Navigate to a new location (pushes history) */
    push(to: RawLocation): Promise<void>;
    /** Replace current history entry */
    replace(to: RawLocation): Promise<void>;
    /** Go back/forward in history */
    go(delta: number): void;
    back(): void;
    forward(): void;
    /** Resolve a raw location to a RouteLocation without navigating */
    resolve(to: RawLocation): (RouteLocation & {
        href: string;
    }) | null;
    /** Register a global before-each guard */
    beforeEach(guard: NavigationGuard): () => void;
    /** Register a global after-each hook */
    afterEach(hook: (to: RouteLocation, from: RouteLocation | null) => void): () => void;
    /** Attach to an app via .use() */
    install: Plugin['install'];
}
declare function createRouter(options: RouterOptions): Router;
/**
 * Access the router inside a component.
 *
 * @example
 * const router = useRouter()
 * router.push('/dashboard')
 */
declare function useRouter(): Router;
/**
 * Reactive current route.
 *
 * @example
 * const route = useRoute()
 * const id = computed(() => route().params.id)
 */
declare function useRoute(): Signal<RouteLocation>;
/**
 * Renders the component matched by the current route.
 * Supports nested RouterViews via `depth` (auto-incremented through context).
 *
 * Must be used inside a defineComponent setup().
 *
 * @example
 * div().class('flex flex-col').children(
 *   Navbar(),
 *   RouterView(),
 * )
 */
declare function RouterView(): Node;
interface RouterLinkProps {
    /** Статичный путь или реактивный геттер для динамических ссылок */
    to: MaybeReactive<RawLocation>;
    /** Extra classes always applied */
    class?: string;
    /** Classes added when route is active */
    activeClass?: string;
    /** Classes added when route is exactly active */
    exactActiveClass?: string;
    /** Use replace instead of push */
    replace?: boolean;
}
/**
 * A declarative navigation link. Automatically adds active classes.
 *
 * @example
 * RouterLink({
 *   to: '/about',
 *   class: 'px-4 py-2 rounded',
 *   activeClass: 'bg-primary text-white',
 * })
 */
declare function RouterLink(props: RouterLinkProps & {
    children?: Node | string;
}): Node;

declare const VERSION = "0.1.0";

export { type App, type Child, type ComponentInstance, type Computed, type DatasetInput, ElementBuilder, type EmitFn, type EventMap, For, type Getter, type InjectionKey, type MaybeReactive, type NavigationGuard, type Plugin, type PropsBase, ROUTER_KEY, type RawLocation, type RouteLocation, type RouteMeta, type RouteParams, type RouteQuery, type RouteRecord, type Router, RouterLink, type RouterLinkProps, type RouterOptions, RouterView, type SetupFn, Show, type Signal, type StyleInput, VERSION, type WatchOptions, a, article, batch, button, computed, createApp, createEmit, createRouter, defineComponent, destroyNode, div, effect, el, footer, form, fragment, getComponentInstance, h1, h2, h3, header, img, inject, injectionKey, input, label, li, main, mount, mountComponent, nav, onDestroy, onMount, onUpdate, option, p, provideLocal, section, select, setEffectRunner, signal, span, textarea, toSignals, ul, untrack, useEffect, useRoute, useRouter, watch };

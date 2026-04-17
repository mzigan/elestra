// ─────────────────────────────────────────────────────────────────────────────
// router.ts
// Client-side router: hash & history mode · nested routes · guards · transitions
// ─────────────────────────────────────────────────────────────────────────────

import { signal, effect, type Signal } from './reactivity'
import {
    inject,
    provideLocal,
    injectionKey,
    type ComponentInstance,
    type Plugin,
    type App,
    getCurrentContext,
    contextStack,
} from './component'
import { destroyNode, registerDestroyHook, type MaybeReactive } from './element-builder'

// ─── Types ────────────────────────────────────────────────────────────────────

export type RouteParams = Record<string, string>
export type RouteQuery = Record<string, string>

/** A resolved location — what the router knows about the current URL */
export interface RouteLocation {
    path: string
    params: RouteParams
    query: RouteQuery
    hash: string
    /** Full matched route definition chain (parent → child) */
    matched: RouteRecord[]
    /** Arbitrary metadata attached to the route definition */
    meta: RouteMeta
}

export type RouteMeta = Record<string, unknown>

/** One entry in the route config */
export interface RouteRecord {
    path: string
    /** Component factory — receives params & returns a ComponentInstance */
    component?: (props?: any) => ComponentInstance
    /** Nested routes */
    children?: RouteRecord[]
    meta?: RouteMeta
    /** Redirect to another path (string or function) */
    redirect?: string | ((to: RouteLocation) => string)
    /** Route-level guard — return false or a path string to block/redirect */
    beforeEnter?: NavigationGuard
    /** Name for programmatic navigation */
    name?: string
}

export type NavigationGuard = (
    to: RouteLocation,
    from: RouteLocation | null,
) => boolean | string | void | Promise<boolean | string | void>

/** What you pass to router.push / router.replace */
export type RawLocation =
    | string
    | { path: string; query?: RouteQuery; hash?: string }
    | { name: string; params?: RouteParams; query?: RouteQuery; hash?: string }

// ─── Injection keys ───────────────────────────────────────────────────────────

export const ROUTER_KEY = injectionKey<Router>('router')
const ROUTER_VIEW_DEPTH_KEY = injectionKey<number>('router-view-depth')

// ─── Path matching ────────────────────────────────────────────────────────────

interface MatchResult {
    params: RouteParams
    matched: RouteRecord[]
}

/**
 * Convert a route path pattern to a RegExp.
 * Supports :param and :param? (optional) segments.
 *
 * /users/:id        → /users/42          { id: '42' }
 * /files/:path*     → /files/a/b/c       { path: 'a/b/c' }
 */
function pathToRegex(pattern: string): { regex: RegExp; keys: string[] } {
    const keys: string[] = []
    const src = pattern
        .replace(/\//g, '\\/')
        .replace(/:(\w+)(\*)?(\?)?/g, (_, key, star, opt) => {
            keys.push(key)
            if (star) return '(.*?)'   // FIX #9: non-greedy to avoid swallowing subsequent segments
            if (opt) return '([^\\/]*)?'
            return '([^\\/]+)'
        })
    return { regex: new RegExp(`^${src}\\/?$`), keys }
}

function matchRoute(
    path: string,
    routes: RouteRecord[],
    parent: RouteRecord[] = [],
): MatchResult | null {
    for (const route of routes) {
        const fullPattern =
            parent.length > 0
                ? joinPaths(parent.at(-1)!.path, route.path)
                : route.path

        const { regex, keys } = pathToRegex(fullPattern)
        const match = path.match(regex)

        if (match) {
            const params: RouteParams = {}
            keys.forEach((k, i) => {
                const value = match[i + 1]
                if (value !== undefined) params[k] = decodeURIComponent(value)
            })
            const matched = [...parent, route]

            // Try children first (most specific wins)
            if (route.children?.length) {
                const child = matchRoute(path, route.children, matched)
                if (child) return child
            }

            return { params, matched }
        }
    }
    return null
}

function joinPaths(a: string, b: string): string {
    return `${a.replace(/\/$/, '')}/${b.replace(/^\//, '')}`
}

// ─── URL helpers ──────────────────────────────────────────────────────────────

function parseSearch(search: string): RouteQuery {
    const q: RouteQuery = {}
    new URLSearchParams(search).forEach((v, k) => { q[k] = v })
    return q
}

function buildSearch(query: RouteQuery): string {
    const p = new URLSearchParams(query)
    const s = p.toString()
    return s ? `?${s}` : ''
}

function getCurrentPath(mode: 'hash' | 'history'): string {
    if (mode === 'hash') {
        return decodeURIComponent(window.location.hash.slice(1) || '/')
    }
    return decodeURIComponent(window.location.pathname)
}

function getCurrentQuery(): RouteQuery {
    return parseSearch(window.location.search)
}

function getCurrentHash(): string {
    return window.location.hash
}

// ─── Router ───────────────────────────────────────────────────────────────────

export interface RouterOptions {
    routes: RouteRecord[]
    mode?: 'hash' | 'history'   // default: 'history'
    /** Global navigation guard */
    beforeEach?: NavigationGuard
    /** Called after every successful navigation */
    afterEach?: (to: RouteLocation, from: RouteLocation | null) => void
}

export interface Router {
    /** Current resolved route (reactive signal) */
    readonly current: Signal<RouteLocation>

    /** Navigate to a new location (pushes history) */
    push(to: RawLocation): Promise<void>

    /** Replace current history entry */
    replace(to: RawLocation): Promise<void>

    /** Go back/forward in history */
    go(delta: number): void
    back(): void
    forward(): void

    /** Resolve a raw location to a RouteLocation without navigating */
    resolve(to: RawLocation): (RouteLocation & { href: string }) | null

    /** Register a global before-each guard */
    beforeEach(guard: NavigationGuard): () => void

    /** Register a global after-each hook */
    afterEach(hook: (to: RouteLocation, from: RouteLocation | null) => void): () => void

    /** Attach to an app via .use() */
    install: Plugin['install']
}

const NOT_FOUND_LOCATION: RouteLocation = {
    path: '/404',
    params: {},
    query: {},
    hash: '',
    matched: [],
    meta: {},
}

export function createRouter(options: RouterOptions): Router {
    const mode = options.mode ?? 'history'

    const beforeEachGuards: NavigationGuard[] = options.beforeEach ? [options.beforeEach] : []
    const afterEachHooks: Array<(to: RouteLocation, from: RouteLocation | null) => void> =
        options.afterEach ? [options.afterEach] : []

    // ── Build name map for named navigation ──
    const nameMap = new Map<string, RouteRecord>()
    function indexRoutes(routes: RouteRecord[]) {
        for (const r of routes) {
            if (r.name) nameMap.set(r.name, r)
            if (r.children) indexRoutes(r.children)
        }
    }
    indexRoutes(options.routes)

    function buildHref(path: string, query: RouteQuery, hash: string): string {
        const search = buildSearch(query)
        if (mode === 'hash') {
            return `${window.location.pathname}${search}#${path}${hash}`
        }
        return `${path}${search}${hash}`
    }

    // ── Resolve a RawLocation to a { path, query, hash } ──
    function rawToPath(to: RawLocation): { path: string; query: RouteQuery; hash: string } {
        if (typeof to === 'string') {
            // FIX #7: handle hash-only strings like '#section' without mangling path
            if (to.startsWith('#')) {
                return {
                    path: getCurrentPath(mode),
                    query: getCurrentQuery(),
                    hash: to
                }
            }
            const url = new URL(to, 'http://x')
            return { path: url.pathname, query: parseSearch(url.search), hash: url.hash }
        }
        if ('name' in to) {
            const record = nameMap.get(to.name)
            if (!record) throw new Error(`router: no route named "${to.name}"`)
            let path = record.path
            for (const [k, v] of Object.entries(to.params ?? {})) {
                path = path.replace(`:${k}`, encodeURIComponent(v))
            }
            return { path, query: to.query ?? {}, hash: to.hash ?? '' }
        }
        return { path: to.path, query: to.query ?? {}, hash: to.hash ?? '' }
    }

    // Добавлен параметр redirectCount = 0
    function resolveLocation(path: string, query: RouteQuery, hash: string, redirectCount = 0): RouteLocation {
        // РЕШЕНИЕ БАГА 3: Защита от бесконечного редиректа
        if (redirectCount > 10) {
            console.error('Router: Infinite redirect detected')
            return { ...NOT_FOUND_LOCATION, path, query, hash }
        }

        const match = matchRoute(path, options.routes)
        if (!match) return { ...NOT_FOUND_LOCATION, path, query, hash }

        const record = match.matched.at(-1)!

        if (record.redirect) {
            const target =
                typeof record.redirect === 'function'
                    ? record.redirect({ path, params: match.params, query, hash, matched: match.matched, meta: record.meta ?? {} })
                    : record.redirect
            const next = rawToPath(target)
            // ПЕРЕДАЕМ +1 в рекурсию
            const resolved = resolveLocation(next.path, next.query, next.hash, redirectCount + 1)
                ; (resolved as any).__redirect = true
            return resolved
        }

        return {
            path,
            params: match.params,
            query,
            hash,
            matched: match.matched,
            meta: record.meta ?? {},
        }
    }

    // ── Initial route ──
    const initialPath = getCurrentPath(mode)
    const initialQuery = getCurrentQuery()
    const initialHash = getCurrentHash()
    const initialRoute = resolveLocation(initialPath, initialQuery, initialHash)

    const current = signal<RouteLocation>(initialRoute)
    let fromRoute: RouteLocation | null = null

    // ── Navigation ──
    async function navigate(
        to: RawLocation,
        replace: boolean,
    ): Promise<void> {
        const { path, query, hash } = rawToPath(to)
        const resolved = resolveLocation(path, query, hash)

        // Redirects always use replaceState to avoid polluting history
        const useReplace = replace || !!(resolved as any).__redirect

        // Run global guards
        for (const guard of beforeEachGuards) {
            const result = await guard(resolved, current.peek())
            if (result === false) return
            if (typeof result === 'string') return navigate(result, useReplace)
        }

        // Run route-level guard
        const record = resolved.matched.at(-1)
        if (record?.beforeEnter) {
            const result = await record.beforeEnter(resolved, current.peek())
            if (result === false) return
            if (typeof result === 'string') return navigate(result, useReplace)
        }

        fromRoute = current.peek()

        // Update browser URL
        const url = buildHref(path, query, hash)

        if (useReplace) {
            window.history.replaceState({ path, query, hash }, '', url)
        } else {
            window.history.pushState({ path, query, hash }, '', url)
        }

        current.set(resolved)

        for (const hook of afterEachHooks) hook(resolved, fromRoute)
    }

    // ── Popstate (back/forward) ──
    // FIX #12: update fromRoute on popstate so afterEach gets correct `from`
    window.addEventListener('popstate', () => {
        const path = getCurrentPath(mode)
        const query = getCurrentQuery()
        const hash = getCurrentHash()
        fromRoute = current.peek()
        current.set(resolveLocation(path, query, hash))
    })

    // ── Intercept <a> clicks in history mode ──
    if (mode === 'history') {
        document.addEventListener('click', (e) => {
            // FIX #10: don't intercept modifier keys (Cmd/Ctrl/Shift+Click)
            if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return

            const anchor = (e.target as Element).closest('a')
            if (!anchor) return

            // FIX #15: don't intercept target="_blank" or other targets
            const target = anchor.getAttribute('target')
            if (target && target !== '_self') return

            const href = anchor.getAttribute('href')
            if (!href || href.startsWith('http') || href.startsWith('//')) return

            e.preventDefault()
            navigate(href, false)
        })
    }

    const router: Router = {
        current,

        push: (to) => navigate(to, false),
        replace: (to) => navigate(to, true),
        go: (delta) => window.history.go(delta),
        back: () => window.history.go(-1),
        forward: () => window.history.go(1),

        resolve(to) {
            try {
                const { path, query, hash } = rawToPath(to)
                const location = resolveLocation(path, query, hash)
                if (!location) return null

                // Возвращаем локацию + готовый href для тега <a>
                return { ...location, href: buildHref(path, query, hash) }
            } catch {
                return null
            }
        },

        beforeEach(guard) {
            beforeEachGuards.push(guard)
            return () => {
                const i = beforeEachGuards.indexOf(guard)
                if (i !== -1) beforeEachGuards.splice(i, 1)
            }
        },

        afterEach(hook) {
            afterEachHooks.push(hook)
            return () => {
                const i = afterEachHooks.indexOf(hook)
                if (i !== -1) afterEachHooks.splice(i, 1)
            }
        },

        install(app: App) {
            app.provide(ROUTER_KEY, router)
        },
    }

    return router
}

// ─── Composables ──────────────────────────────────────────────────────────────

/**
 * Access the router inside a component.
 *
 * @example
 * const router = useRouter()
 * router.push('/dashboard')
 */
export function useRouter(): Router {
    return inject(ROUTER_KEY)
}

/**
 * Reactive current route.
 *
 * @example
 * const route = useRoute()
 * const id = computed(() => route().params.id)
 */
export function useRoute(): Signal<RouteLocation> {
    return inject(ROUTER_KEY).current
}

// ─── RouterView ───────────────────────────────────────────────────────────────

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
export function RouterView(): Node {
    const router = useRouter()
    const route = router.current

    // 1. Захватываем контекст РОДИТЕЛЯ прямо сейчас (пока мы внутри его setup)
    const parentCtx = getCurrentContext()
    if (!parentCtx) throw new Error('RouterView must be used inside defineComponent setup')

    const depth = inject(ROUTER_VIEW_DEPTH_KEY, 0)

    const anchor = document.createComment('RouterView')
    let currentEl: Node = anchor
    // let currentInstance: ComponentInstance | undefined

    function swap(next: Node) {
        if (next === currentEl) return

        // Атомарная замена
        if (currentEl === anchor) {
            anchor.after(next)
        } else if (currentEl.parentNode) {
            currentEl.parentNode.replaceChild(next, currentEl)
        }

        // Чистка JS
        if (currentEl !== anchor) {
            destroyNode(currentEl)
        }

        // currentInstance = undefined
        currentEl = next
    }

    function runRouterEffect() {
        const matched = route().matched
        const record = matched[depth]

        if (!record) {
            swap(document.createComment('rv-empty'))
            return
        }

        if (!record.component) {
            console.warn(`RouterView: Route at depth ${depth} ("${record.path}") has no component to render.`)
            swap(document.createComment('rv-empty'))
            return
        }

        // 2. Временно возвращаем контекст родителя в стек!
        // Благодаря этому provideLocal сработает, а дочерний defineComponent 
        // корректно увидит цепочку провайдеров при своем вызове inject().
        if (!parentCtx) throw new Error('RouterView must be used inside defineComponent setup')

        let instance: ComponentInstance
        contextStack.push(parentCtx)
        try {
            provideLocal(ROUTER_VIEW_DEPTH_KEY, depth + 1)

            instance = record.component({
                params: route().params,
                query: route().query,
                meta: route().meta,
            })
        }
        finally {
            // 3. Сразу убираем, чтобы не засорять стек
            contextStack.pop()
        }

        swap(instance.el)
        // currentInstance = instance
        instance._mount()
    }

    // 4. Деферредный запуск без MutationObserver
    parentCtx.mountCallbacks.push(() => {
        const cleanup = effect(runRouterEffect)
        parentCtx.effectCleanups.push(cleanup)
    })

    return anchor
}

// ─── RouterLink ───────────────────────────────────────────────────────────────

export interface RouterLinkProps {
    /** Статичный путь или реактивный геттер для динамических ссылок */
    to: MaybeReactive<RawLocation>
    /** Extra classes always applied */
    class?: string
    /** Classes added when route is active */
    activeClass?: string
    /** Classes added when route is exactly active */
    exactActiveClass?: string
    /** Use replace instead of push */
    replace?: boolean
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
export function RouterLink(props: RouterLinkProps & { children?: Node | string }): Node {
    const router = useRouter()
    const route = router.current

    const activeClass = props.activeClass ?? 'router-link-active'
    const exactActiveClass = props.exactActiveClass ?? 'router-link-exact-active'

    const anchor = document.createElement('a')

    // Общие стили и дети (не реактивные)
    if (props.class) {
        anchor.classList.add(...props.class.split(/\s+/).filter(Boolean))
    }
    if (props.children) {
        if (typeof props.children === 'string') {
            anchor.textContent = props.children
        } else {
            anchor.appendChild(props.children)
        }
    }

    // Общий обработчик клика
    anchor.addEventListener('click', (e) => {
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return
        e.preventDefault()
        
        // Читаем актуальное значение to в момент клика
        const to = typeof props.to === 'function' ? props.to() : props.to
        if (props.replace) {
            router.replace(to)
        } else {
            router.push(to)
        }
    })

    // ВЕТВЛЕНИЕ: Проверяем тип props.to ровно один раз при создании элемента
    if (typeof props.to === 'function') {
        // ==========================================
        // СЦЕНАРИЙ 1: Динамическая ссылка (5% случаев)
        // ==========================================
        
        const dynamicTo = props.to

        // Создаем ТОЛЬКО ОДИН эффект вместо четырех!
        const cleanup = effect(() => {
            const to = dynamicTo()
            const resolved = router.resolve(to)
            
            // 1. Обновляем href
            anchor.href = resolved?.href ?? '/'

            // 2. Вычисляем активность
            const current = route()
            const targetRecord = resolved?.matched.at(-1)
            const isAct = targetRecord ? current.matched.some(r => r === targetRecord) : false
            const isExact = resolved ? current.path === resolved.path : false

            // 3. Тоглим классы
            anchor.classList.toggle(activeClass, isAct)
            anchor.classList.toggle(exactActiveClass, isExact)
        })

        registerDestroyHook(anchor, cleanup)

    } else {
        // ==========================================
        // СЦЕНАРИЙ 2: Статичная ссылка (95% случаев)
        // ==========================================
        
        const staticTo = props.to
        
        // 1. Резолвим ссылку СИНХРОННО один раз. Никаких computed.
        const resolved = router.resolve(staticTo)
        const staticHref = resolved?.href ?? (typeof staticTo === 'string' ? staticTo : '/')
        anchor.href = staticHref

        // Запоминаем целевую запись роута для быстрого сравнения
        const targetRecord = resolved?.matched.at(-1)
        const staticPath = resolved?.path

        // 2. Создаем ТОЛЬКО ОДИН легкий эффект только для классов.
        // Он не пересчитывает href и не вызывает router.resolve() при навигации!
        const cleanup = effect(() => {
            const current = route() // Читаем только сигнал роута
            
            const isAct = targetRecord ? current.matched.some(r => r === targetRecord) : false
            const isExact = staticPath ? current.path === staticPath : false

            anchor.classList.toggle(activeClass, isAct)
            anchor.classList.toggle(exactActiveClass, isExact)
        })

        registerDestroyHook(anchor, cleanup)
    }

    return anchor
}

// ─────────────────────────────────────────────────────────────────────────────
// reactivity.ts
// ─────────────────────────────────────────────────────────────────────────────

type Subscriber = () => void
type Dep = Set<Subscriber>

// ─── Tracking context ────────────────────────────────────────────────────────
let activeEffect: ReactiveEffect | null = null

// ─── Scheduler ───────────────────────────────────────────────────────────────
const pendingEffects = new Set<ReactiveEffect>()
let flushScheduled = false
let batchDepth = 0
let isFlushing = false

function scheduleFlush(): void {
    if (batchDepth > 0) return
    // Если мы УЖЕ внутри цикла flush, while(pendingEffects.size > 0) подхватит новые эффекты.
    // Нет нужды ставить новую микрозадачу в очередь.
    if (isFlushing) return
    // Если микрозадача уже стоит в очереди браузера, ничего не делаем.
    if (flushScheduled) return

    flushScheduled = true
    queueMicrotask(flush)
}

function flush(): void {
    // Сбрасываем флаг очереди. Если во время выполнения эффектов изменится сигнал,
    // scheduleFlush увидит flushScheduled = false, но isFlushing = true, и не поставит лишнюю задачу.
    flushScheduled = false
    isFlushing = true

    try {
        while (pendingEffects.size > 0) {
            const effectsToRun = [...pendingEffects]
            pendingEffects.clear()
            for (const effect of effectsToRun) {
                effect._run()
            }
        }
    } finally {
        isFlushing = false
    }
}

// ─── ReactiveEffect ──────────────────────────────────────────────────────────

class ReactiveEffect {
    private _fn: () => void
    private _onInvalidate: () => void
    private _onError?: (err: unknown) => void
    private _deps = new Set<Dep>()
    private _active = true

    constructor(
        fn: () => void,
        onInvalidate?: () => void,
        immediate = false,
        onError?: (err: unknown) => void // 🆕
    ) {
        this._fn = fn
        this._onInvalidate = onInvalidate || (() => { })
        this._onError = onError // 🆕
        if (immediate) this._run()
    }

    /** Вызывается сигналами при изменении */
    _schedule(): void {
        if (!this._active) return
        // Исправление №1: синхронно сбрасываем флаг (через коллбек)
        this._onInvalidate()
        pendingEffects.add(this)
        scheduleFlush()
    }

    /** Реальный запуск */
    _run(): void {
        if (!this._active) return

        pendingEffects.delete(this)
        this._cleanup()

        const prevEffect = activeEffect
        activeEffect = this
        try {
            this._fn()
        } catch (err) {
            // 1. Обязательно логируем, чтобы не скрыть проблему
            console.error('[Elestra] Error in reactive effect:', err)

            // 2. Вызываем пользовательский обработчик (если есть)
            this._onError?.(err)

            // 3. НЕ делаем dispose! 
            // Эффект остаётся активным, но подписан только на зависимости,
            // прочитанные до момента исключения. Если ошибка не связана с ними,
            // эффект может не восстановиться автоматически.
            // Полное восстановление гарантировано только если исправятся данные,
            // читаемые ДО места падения.            
        } finally {
            activeEffect = prevEffect
        }
    }

    track(dep: Dep): void {
        dep.add(this._boundSchedule)
        this._deps.add(dep)
    }

    private _cleanup(): void {
        for (const dep of this._deps) {
            dep.delete(this._boundSchedule)
        }
        this._deps.clear()
    }

    readonly _boundSchedule = () => this._schedule()

    dispose(): void {
        this._active = false
        this._cleanup()
        pendingEffects.delete(this)
    }
}

// ─── Signal ──────────────────────────────────────────────────────────────────

export interface Signal<T> {
    (): T
    set(value: T): void
    update(fn: (prev: T) => T): void
    peek(): T
}

export function signal<T>(initialValue: T): Signal<T> {
    let _value = initialValue
    const _subscribers: Dep = new Set()

    function notify(): void {
        for (const sub of [..._subscribers]) sub()
    }

    const sig = function (): T {
        if (activeEffect) {
            activeEffect.track(_subscribers)
        }
        return _value
    } as Signal<T>

    sig.set = (value: T): void => {
        if (Object.is(_value, value)) return
        _value = value
        notify()
    }

    sig.update = (fn: (prev: T) => T): void => {
        sig.set(fn(_value))
    }

    sig.peek = (): T => _value

    return sig
}

// ─── effect ──────────────────────────────────────────────────────────────────

export function effect(fn: () => void): () => void {
    const e = new ReactiveEffect(fn, undefined, true)
    return () => e.dispose()
}

// ─── computed ─────────────────────────────────────────────────────────────────

export interface Computed<T> {
    (): T
    dispose(): void
}

export function computed<T>(fn: () => T): Computed<T> {
    let _cachedValue!: T
    let _hasValue = false // Нужен, чтобы не триггерить подписчиков при первичной сборке графа
    let _dirty = true
    const _subscribers: Dep = new Set()

    const e = new ReactiveEffect(
        () => {
            const newValue = fn()
            // Уведомляем только если значение реально изменилось И это не первая инициализация
            if (!_hasValue || !Object.is(newValue, _cachedValue)) {
                const isUpdate = _hasValue
                _hasValue = true
                _cachedValue = newValue

                if (isUpdate) {
                    for (const sub of [..._subscribers]) sub()
                }
            }
            _dirty = false
        },
        () => {
            // Исправление №1: Этот коллбек вызовется синхронно в _schedule()
            _dirty = true
        },
        false
    )

    const getter = function (): T {
        if (activeEffect) {
            activeEffect.track(_subscribers)
        }

        if (_dirty) {
            e._run()
        }

        return _cachedValue
    } as Computed<T>

    getter.dispose = () => e.dispose()

    return getter
}

// ─── watch ───────────────────────────────────────────────────────────────────

export interface WatchOptions {
    immediate?: boolean
}

export function watch<T>(
    source: () => T,
    callback: (newValue: T, oldValue: T | undefined) => void,
    options: WatchOptions = {},
): () => void {
    let oldValue: T | undefined = undefined
    let isFirst = true

    // watch не нуждается в onInvalidate, передаем undefined
    const e = new ReactiveEffect(() => {
        const newValue = source()
        if (isFirst) {
            if (options.immediate) callback(newValue, undefined)
            oldValue = newValue
            isFirst = false
            return
        }
        if (!Object.is(newValue, oldValue)) {
            const prev = oldValue
            oldValue = newValue
            callback(newValue, prev)
        }
    }, undefined, true)

    return () => e.dispose()
}

// ─── batch ───────────────────────────────────────────────────────────────────

export function batch(fn: () => void): void {
    batchDepth++
    try {
        fn()
    } finally {
        batchDepth--
        if (batchDepth === 0) {
            flush()
        }
    }
}

// ─── untrack ─────────────────────────────────────────────────────────────────

export function untrack<T>(fn: () => T): T {
    const prevEffect = activeEffect
    activeEffect = null
    try {
        return fn()
    } finally {
        activeEffect = prevEffect
    }
}

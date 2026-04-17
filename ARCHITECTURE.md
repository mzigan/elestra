# Elestra Framework Architecture

## Core Philosophy
- NO Virtual DOM. Direct DOM manipulations.
- NO JSX, NO Compiler. Pure TypeScript Builder Pattern (`div().class()`).
- Explicit Reactivity: Pass `Signal` directly to components to keep them reactive.

## Core Modules
- `reactivity.ts`: Push-based signals, lazy `computed`, deferred microtask `flush()` loop.
- `element-builder.ts`: `ElementBuilder` class, `destroyNode()`, `runEffect()` integration, `adopt()` for augmenting existing DOM.
- `component.ts`: `defineComponent`, `contextStack` for lifecycle (`onMount`), `For` (creates `Signal<T>` for every item for fine-grained updates without re-render), `Show`, `createApp` (DI via `provide/inject` with `InjectionKey`).

## Critical Architectural Decisions
- **Why `.class()` takes a getter?** To subscribe the DOM update to the signal *inside* the builder, not the static string.
- **Lifecycle (The `parentCtx` fix):** Effects in `.child()` or `For` cannot read `getCurrentContext()` at runtime (stack is empty). We capture `parentCtx` in a closure during setup and use it inside effects to call `_mount()`.
- **`For` Implementation:** Doesn't pass the raw item `T`. Passes a `Signal<T>` to the `render` function. This means updating `signal.set(item)` inside `For` updates ONLY that specific DOM node, bypassing the whole list reconciliation.
- **No `toSignals`**: Removed to avoid `Signal<Signal<T>` bugs. Pass raw signals directly as props.
- **RouterView:** Uses a temporary `contextStack.push(parentCtx)` trick during the render effect to allow nested `RouterView` to read depths via `inject()`.
- **State Management:** No separate store module needed. Just a factory function returning `{ signal, computed, action }`, provided via `inject()`.

## Benchmarks (vs SolidJS & Lit)
- Elestra Update (1k/10k items): ~15-20ms (faster than compiled SolidJS due to direct `classList.toggle` vs `className = ""`).
- Elestra Create: ~100-120ms. Faster than runtime frameworks, slightly slower than compiled SolidJS due to `ElementBuilder` object allocation.

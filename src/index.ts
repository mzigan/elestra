// ─────────────────────────────────────────────────────────────────────────────
// index.ts
// Public API — import everything from here, never from internal modules.
//
//   import { el, signal, defineComponent, createRouter } from 'elestra'
//
// ─────────────────────────────────────────────────────────────────────────────

// ─── Bootstrap ────────────────────────────────────────────────────────────────
//
// Wire reactivity into the element builder automatically on first import.
// No manual connectReactivity() call needed.

import { effect }          from './reactivity'
import { setEffectRunner } from './element-builder'

setEffectRunner((fn) => effect(fn))

// ─── Element builder ──────────────────────────────────────────────────────────

export {
  // Core factory
  el,
  fragment,
  mount,
  destroyNode,
  setEffectRunner,

  // Typed element shorthands
  div, span, p,
  h1, h2, h3,
  button, input, form,
  img, a,
  ul, li,
  section, article,
  header, footer, nav, main,
  label, select, option, textarea,

  // Types
  type Child,
  type Getter,
  type MaybeReactive,
  type StyleInput,
  type DatasetInput,
  type EventMap,
  ElementBuilder,
} from './element-builder'

// ─── Reactivity ───────────────────────────────────────────────────────────────

export {
  signal,
  computed,
  effect,
  watch,
  batch,
  untrack,

  // Types
  type Signal,
  type Computed,
  type WatchOptions,
} from './reactivity'

// ─── Component system ─────────────────────────────────────────────────────────

export {
  // Definition
  defineComponent,
  createApp,

  // Lifecycle hooks
  onMount,
  onDestroy,
  onUpdate,
  useEffect,

  // emits
  createEmit,

  // DI
  inject,
  provideLocal,
  injectionKey,

  // Rendering helpers
  For,
  Show,

  // Lower-level (for plugin authors)
  mountComponent,
  getComponentInstance,

  // Types
  type ComponentInstance,
  type SetupFn,
  type PropsBase,
  type EmitFn,
  type Plugin,
  type App,
  type InjectionKey,
} from './component'

// ─── Router ───────────────────────────────────────────────────────────────────

export {
  createRouter,
  RouterView,
  RouterLink,
  useRouter,
  useRoute,
  ROUTER_KEY,

  // Types
  type Router,
  type RouterOptions,
  type RouteRecord,
  type RouteLocation,
  type RouteParams,
  type RouteQuery,
  type RouteMeta,
  type RawLocation,
  type NavigationGuard,
  type RouterLinkProps,
} from './router'

// ─── Version ──────────────────────────────────────────────────────────────────

export const VERSION = '0.1.0'

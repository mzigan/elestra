"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  ElementBuilder: () => ElementBuilder,
  For: () => For,
  ROUTER_KEY: () => ROUTER_KEY,
  RouterLink: () => RouterLink,
  RouterView: () => RouterView,
  Show: () => Show,
  VERSION: () => VERSION,
  a: () => a,
  article: () => article,
  batch: () => batch,
  button: () => button,
  computed: () => computed,
  createApp: () => createApp,
  createEmit: () => createEmit,
  createRouter: () => createRouter,
  defineComponent: () => defineComponent,
  destroyNode: () => destroyNode,
  div: () => div,
  effect: () => effect,
  el: () => el,
  footer: () => footer,
  form: () => form,
  fragment: () => fragment,
  getComponentInstance: () => getComponentInstance,
  h1: () => h1,
  h2: () => h2,
  h3: () => h3,
  header: () => header,
  img: () => img,
  inject: () => inject,
  injectionKey: () => injectionKey,
  input: () => input,
  label: () => label,
  li: () => li,
  main: () => main,
  mount: () => mount,
  mountComponent: () => mountComponent,
  nav: () => nav,
  onDestroy: () => onDestroy,
  onMount: () => onMount,
  onUpdate: () => onUpdate,
  option: () => option,
  p: () => p,
  provideLocal: () => provideLocal,
  section: () => section,
  select: () => select,
  setEffectRunner: () => setEffectRunner,
  signal: () => signal,
  span: () => span,
  textarea: () => textarea,
  toSignals: () => toSignals,
  ul: () => ul,
  untrack: () => untrack,
  useEffect: () => useEffect,
  useRoute: () => useRoute,
  useRouter: () => useRouter,
  watch: () => watch
});
module.exports = __toCommonJS(index_exports);

// src/reactivity.ts
var activeEffect = null;
var pendingEffects = /* @__PURE__ */ new Set();
var flushScheduled = false;
var batchDepth = 0;
function scheduleFlush() {
  if (batchDepth > 0) return;
  if (flushScheduled) return;
  flushScheduled = true;
  queueMicrotask(flush);
}
function flush() {
  flushScheduled = false;
  const effectsToRun = [...pendingEffects];
  pendingEffects.clear();
  for (const effect2 of effectsToRun) {
    effect2._run();
  }
}
var ReactiveEffect = class {
  _fn;
  _onInvalidate;
  _deps = /* @__PURE__ */ new Set();
  _active = true;
  constructor(fn, onInvalidate, immediate = false) {
    this._fn = fn;
    this._onInvalidate = onInvalidate || (() => {
    });
    if (immediate) this._run();
  }
  /** Вызывается сигналами при изменении */
  _schedule() {
    if (!this._active) return;
    this._onInvalidate();
    pendingEffects.add(this);
    scheduleFlush();
  }
  /** Реальный запуск */
  _run() {
    if (!this._active) return;
    pendingEffects.delete(this);
    this._cleanup();
    const prevEffect = activeEffect;
    activeEffect = this;
    try {
      this._fn();
    } finally {
      activeEffect = prevEffect;
    }
  }
  track(dep) {
    dep.add(this._boundSchedule);
    this._deps.add(dep);
  }
  _cleanup() {
    for (const dep of this._deps) {
      dep.delete(this._boundSchedule);
    }
    this._deps.clear();
  }
  _boundSchedule = () => this._schedule();
  dispose() {
    this._active = false;
    this._cleanup();
    pendingEffects.delete(this);
  }
};
function signal(initialValue) {
  let _value = initialValue;
  const _subscribers = /* @__PURE__ */ new Set();
  function notify() {
    for (const sub of [..._subscribers]) sub();
  }
  const sig = function() {
    if (activeEffect) {
      activeEffect.track(_subscribers);
    }
    return _value;
  };
  sig.set = (value) => {
    if (Object.is(_value, value)) return;
    _value = value;
    notify();
  };
  sig.update = (fn) => {
    sig.set(fn(_value));
  };
  sig.peek = () => _value;
  return sig;
}
function effect(fn) {
  const e = new ReactiveEffect(fn, void 0, true);
  return () => e.dispose();
}
function computed(fn) {
  let _cachedValue;
  let _hasValue = false;
  let _dirty = true;
  const _subscribers = /* @__PURE__ */ new Set();
  const e = new ReactiveEffect(
    () => {
      const newValue = fn();
      if (!_hasValue || !Object.is(newValue, _cachedValue)) {
        const isUpdate = _hasValue;
        _hasValue = true;
        _cachedValue = newValue;
        if (isUpdate) {
          for (const sub of [..._subscribers]) sub();
        }
      }
      _dirty = false;
    },
    () => {
      _dirty = true;
    },
    false
  );
  const getter = function() {
    if (activeEffect) {
      activeEffect.track(_subscribers);
    }
    if (_dirty) {
      e._run();
    }
    return _cachedValue;
  };
  getter.dispose = () => e.dispose();
  return getter;
}
function watch(source, callback, options = {}) {
  let oldValue = void 0;
  let isFirst = true;
  const e = new ReactiveEffect(() => {
    const newValue = source();
    if (isFirst) {
      if (options.immediate) callback(newValue, void 0);
      oldValue = newValue;
      isFirst = false;
      return;
    }
    if (!Object.is(newValue, oldValue)) {
      const prev = oldValue;
      oldValue = newValue;
      callback(newValue, prev);
    }
  }, void 0, true);
  return () => e.dispose();
}
function batch(fn) {
  batchDepth++;
  try {
    fn();
  } finally {
    batchDepth--;
    if (batchDepth === 0) {
      flush();
    }
  }
}
function untrack(fn) {
  const prevEffect = activeEffect;
  activeEffect = null;
  try {
    return fn();
  } finally {
    activeEffect = prevEffect;
  }
}

// src/element-builder.ts
var _effectRunner = null;
function setEffectRunner(runner) {
  if (_effectRunner) return;
  _effectRunner = runner;
}
function runEffect(fn) {
  return _effectRunner ? _effectRunner(fn) : void 0;
}
var destroyHooks = /* @__PURE__ */ new WeakMap();
function registerDestroyHook(node, fn) {
  destroyHooks.set(node, fn);
}
var cleanupRegistry = /* @__PURE__ */ new WeakMap();
function addCleanup(node, fn) {
  const list = cleanupRegistry.get(node) ?? [];
  list.push(fn);
  cleanupRegistry.set(node, list);
}
function destroyNode(node) {
  destroyHooks.get(node)?.();
  destroyHooks.delete(node);
  const cleanups = cleanupRegistry.get(node);
  if (cleanups) {
    cleanups.forEach((fn) => fn());
    cleanupRegistry.delete(node);
  }
  node.childNodes.forEach(destroyNode);
}
function isGetter(v) {
  return typeof v === "function";
}
function resolveChild(child) {
  if (child instanceof ElementBuilder) return child.build();
  if (child instanceof Node) return child;
  if (child === null || child === void 0 || child === false) {
    return document.createComment("");
  }
  return document.createTextNode(String(child));
}
var ElementBuilder = class {
  _el;
  _cleanups = [];
  constructor(tag) {
    this._el = document.createElement(tag);
  }
  // ─── Classes (Tailwind v4 utilities) ────────────────────────────────────
  /** Add static or reactive Tailwind classes */
  class(value) {
    if (isGetter(value)) {
      let prevSet = /* @__PURE__ */ new Set();
      const cleanup = runEffect(() => {
        const next = value();
        const nextSet = new Set(next.split(/\s+/).filter(Boolean));
        for (const cls of prevSet) {
          if (!nextSet.has(cls)) this._el.classList.remove(cls);
        }
        for (const cls of nextSet) {
          if (!prevSet.has(cls)) this._el.classList.add(cls);
        }
        prevSet = nextSet;
      });
      if (cleanup) this._cleanups.push(cleanup);
    } else {
      this._el.classList.add(...value.split(/\s+/).filter(Boolean));
    }
    return this;
  }
  /** Toggle a class conditionally (reactive or static) */
  classIf(cls, condition) {
    if (isGetter(condition)) {
      const cleanup = runEffect(() => {
        this._el.classList.toggle(cls, condition());
      });
      if (cleanup) this._cleanups.push(cleanup);
    } else {
      this._el.classList.toggle(cls, condition);
    }
    return this;
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
  style(styles) {
    const apply = (prop, resolved) => {
      if (resolved === "" || resolved === null) {
        if (prop.startsWith("--")) {
          this._el.style.removeProperty(prop);
        } else {
          this._el.style[prop] = "";
          this._el.style.removeProperty(prop);
        }
      } else {
        if (prop.startsWith("--")) {
          this._el.style.setProperty(prop, resolved);
        } else {
          this._el.style[prop] = resolved;
        }
      }
    };
    for (const [prop, value] of Object.entries(styles)) {
      if (isGetter(value)) {
        const cleanup = runEffect(() => apply(prop, value()));
        if (cleanup) this._cleanups.push(cleanup);
      } else {
        apply(prop, value);
      }
    }
    return this;
  }
  /**
   * Set a single CSS custom property.
   *
   * @example
   * el('div').cssVar('--color-accent', signal('#ff0000'))
   */
  cssVar(name, value) {
    return this.style({ [name]: value });
  }
  // ─── Attributes ──────────────────────────────────────────────────────────
  /** Set an HTML attribute (static or reactive) */
  attr(name, value) {
    const apply = (v) => {
      if (v === null || v === false) {
        this._el.removeAttribute(name);
      } else if (v === true) {
        this._el.setAttribute(name, "");
      } else {
        this._el.setAttribute(name, v);
      }
    };
    if (isGetter(value)) {
      const cleanup = runEffect(() => apply(value()));
      if (cleanup) this._cleanups.push(cleanup);
    } else {
      apply(value);
    }
    return this;
  }
  /** Shorthand: id attribute */
  id(value) {
    return this.attr("id", value);
  }
  /** Shorthand: aria-* attributes */
  aria(name, value) {
    return this.attr(`aria-${name}`, value);
  }
  /** Shorthand: data-* attributes */
  data(dataset) {
    for (const [key, value] of Object.entries(dataset)) {
      this.attr(`data-${key}`, value);
    }
    return this;
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
  text(value) {
    this._el.childNodes.forEach(destroyNode);
    const node = document.createTextNode("");
    this._el.replaceChildren(node);
    if (isGetter(value)) {
      const cleanup = runEffect(() => {
        node.textContent = String(value());
      });
      if (cleanup) this._cleanups.push(cleanup);
    } else {
      node.textContent = String(value);
    }
    return this;
  }
  // ─── Children ────────────────────────────────────────────────────────────
  /**
   * Append static children. For dynamic lists use the dedicated `For` helper.
   */
  children(...kids) {
    for (const child of kids) {
      const node = resolveChild(child);
      this._el.appendChild(node);
    }
    return this;
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
  child(value) {
    const anchor = document.createComment("child");
    this._el.appendChild(anchor);
    if (isGetter(value)) {
      let currentNode = anchor;
      const cleanup = runEffect(() => {
        const next = resolveChild(value());
        if (next === currentNode) return;
        if (currentNode !== anchor) {
          destroyNode(currentNode);
        }
        if (currentNode === anchor) {
          anchor.after(next);
        } else if (currentNode.parentNode) {
          currentNode.parentNode.replaceChild(next, currentNode);
        }
        currentNode = next;
      });
      if (cleanup) this._cleanups.push(cleanup);
    } else {
      anchor.after(resolveChild(value));
    }
    return this;
  }
  // ─── Events ──────────────────────────────────────────────────────────────
  /**
   * Add an event listener. Automatically cleaned up on destroy().
   *
   * @example
   * el('button').on('click', () => count.set(count() + 1))
   */
  on(event, handler, options) {
    this._el.addEventListener(event, handler, options);
    this._cleanups.push(
      () => this._el.removeEventListener(event, handler, options)
    );
    return this;
  }
  /**
   * Add a one-time event listener.
   */
  once(event, handler) {
    return this.on(event, handler, { once: true });
  }
  // ─── Refs ────────────────────────────────────────────────────────────────
  /**
   * Get a reference to the underlying DOM element during build.
   *
   * @example
   * let inputEl: HTMLInputElement
   * el('input').ref(el => (inputEl = el))
   */
  ref(fn) {
    fn(this._el);
    return this;
  }
  // ─── Lifecycle helpers ───────────────────────────────────────────────────
  /**
   * Run a callback immediately (useful for imperative setup).
   */
  tap(fn) {
    fn(this._el);
    return this;
  }
  // ─── Build ───────────────────────────────────────────────────────────────
  /**
   * Finalise and return the DOM element.
   * Registers all accumulated cleanups on the node.
   */
  build() {
    for (const cleanup of this._cleanups) {
      addCleanup(this._el, cleanup);
    }
    this._cleanups = [];
    return this._el;
  }
  /**
   * Destroy the element — runs all cleanup functions
   * (reactive subscriptions, event listeners).
   */
  destroy() {
    destroyNode(this._el);
  }
};
function el(tag) {
  return new ElementBuilder(tag);
}
var div = () => new ElementBuilder("div");
var span = () => new ElementBuilder("span");
var p = () => new ElementBuilder("p");
var h1 = () => new ElementBuilder("h1");
var h2 = () => new ElementBuilder("h2");
var h3 = () => new ElementBuilder("h3");
var button = () => new ElementBuilder("button");
var input = () => new ElementBuilder("input");
var form = () => new ElementBuilder("form");
var img = () => new ElementBuilder("img");
var a = () => new ElementBuilder("a");
var ul = () => new ElementBuilder("ul");
var li = () => new ElementBuilder("li");
var section = () => new ElementBuilder("section");
var article = () => new ElementBuilder("article");
var header = () => new ElementBuilder("header");
var footer = () => new ElementBuilder("footer");
var nav = () => new ElementBuilder("nav");
var main = () => new ElementBuilder("main");
var label = () => new ElementBuilder("label");
var select = () => new ElementBuilder("select");
var option = () => new ElementBuilder("option");
var textarea = () => new ElementBuilder("textarea");
function fragment(...kids) {
  const frag = document.createDocumentFragment();
  for (const child of kids) {
    frag.appendChild(resolveChild(child));
  }
  return frag;
}
function mount(target, child) {
  const container = typeof target === "string" ? document.querySelector(target) : target;
  if (!container) throw new Error(`mount: target "${target}" not found`);
  const node = child instanceof ElementBuilder ? child.build() : child;
  container.appendChild(node);
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const removed of mutation.removedNodes) {
        if (removed === node) {
          destroyNode(node);
          observer.disconnect();
        }
      }
    }
  });
  observer.observe(container, { childList: true, subtree: false });
  return () => {
    destroyNode(node);
    node.parentNode?.removeChild(node);
    observer.disconnect();
  };
}

// src/component.ts
var contextStack = [];
function getCurrentContext() {
  return contextStack.at(-1) ?? null;
}
function createContext() {
  return {
    mountCallbacks: [],
    destroyCallbacks: [],
    updateCallbacks: [],
    effectCleanups: [],
    provisions: /* @__PURE__ */ new Map()
  };
}
function onMount(fn) {
  const ctx = getCurrentContext();
  if (!ctx) throw new Error("onMount must be called inside defineComponent setup");
  ctx.mountCallbacks.push(fn);
}
function onDestroy(fn) {
  const ctx = getCurrentContext();
  if (!ctx) throw new Error("onDestroy must be called inside defineComponent setup");
  ctx.destroyCallbacks.push(fn);
}
function onUpdate(fn) {
  const ctx = getCurrentContext();
  if (!ctx) throw new Error("onUpdate must be called inside defineComponent setup");
  ctx.updateCallbacks.push(fn);
}
function useEffect(fn) {
  const ctx = getCurrentContext();
  if (!ctx) throw new Error("useEffect must be called inside defineComponent setup");
  ctx.mountCallbacks.push(() => {
    const cleanup = effect(fn);
    ctx.effectCleanups.push(cleanup);
  });
}
function toSignals(props) {
  const result = {};
  for (const key of Object.keys(props)) {
    result[key] = signal(props[key]);
  }
  return result;
}
function createEmit(handlers) {
  return (event, payload) => {
    const handler = handlers[event];
    handler?.(payload);
  };
}
var instanceRegistry = /* @__PURE__ */ new WeakMap();
function getComponentInstance(node) {
  return instanceRegistry.get(node);
}
function defineComponent(setup) {
  return function createInstance(props) {
    const ctx = createContext();
    const resolvedProps = props ?? {};
    contextStack.push(ctx);
    let result;
    try {
      result = setup(resolvedProps);
    } finally {
      contextStack.pop();
    }
    const rootNode = result instanceof ElementBuilder ? result.build() : result;
    const instance = {
      el: rootNode,
      _mount() {
        for (const fn of ctx.mountCallbacks) {
          const cleanup = fn();
          if (typeof cleanup === "function") {
            ctx.destroyCallbacks.push(cleanup);
          }
        }
      },
      _destroy() {
        for (const fn of ctx.effectCleanups) fn();
        for (const fn of ctx.destroyCallbacks) fn();
        ctx.mountCallbacks.length = 0;
        ctx.destroyCallbacks.length = 0;
        ctx.updateCallbacks.length = 0;
        ctx.effectCleanups.length = 0;
      },
      _update() {
        for (const fn of ctx.updateCallbacks) fn();
      }
    };
    instanceRegistry.set(rootNode, instance);
    registerDestroyHook(rootNode, () => instance._destroy());
    return instance;
  };
}
function mountComponent(target, instance) {
  const container = typeof target === "string" ? document.querySelector(target) : target;
  if (!container) throw new Error(`mountComponent: target not found`);
  container.appendChild(instance.el);
  instance._mount();
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const removed of mutation.removedNodes) {
        if (removed === instance.el) {
          destroyNode(instance.el);
          observer.disconnect();
        }
      }
    }
  });
  observer.observe(container, { childList: true, subtree: false });
  return () => {
    destroyNode(instance.el);
    instance.el.parentNode?.removeChild(instance.el);
    observer.disconnect();
  };
}
function injectionKey(description) {
  return Symbol(description);
}
var globalProvisions = /* @__PURE__ */ new Map();
function provideLocal(key, value) {
  const ctx = getCurrentContext();
  if (!ctx) throw new Error("provideLocal must be called inside defineComponent setup");
  ctx.provisions.set(key, value);
}
function inject(key, fallback) {
  for (let i = contextStack.length - 1; i >= 0; i--) {
    const ctx = contextStack[i];
    if (!ctx) continue;
    if (ctx.provisions.has(key)) return ctx.provisions.get(key);
  }
  if (globalProvisions.has(key)) return globalProvisions.get(key);
  if (fallback !== void 0) return fallback;
  throw new Error(`inject: no value provided for key "${String(key)}"`);
}
function createApp(rootComponent, rootProps) {
  const plugins = [];
  const app = {
    mount(target) {
      for (const plugin of plugins) plugin.install(app);
      const instance = rootComponent(rootProps);
      return mountComponent(target, instance);
    },
    use(plugin) {
      plugins.push(plugin);
      return app;
    },
    provide(key, value) {
      globalProvisions.set(key, value);
      return app;
    }
  };
  return app;
}
function For({
  each,
  key,
  render
}) {
  const anchor = document.createComment("For");
  let entries = /* @__PURE__ */ new Map();
  function runReconcile() {
    const list = each();
    const nextKeys = list.map((item, i) => key(item, i));
    const nextSet = new Set(nextKeys);
    const toRemove = [];
    for (const [k, entry] of entries) {
      if (!nextSet.has(k)) {
        const node = entry.node;
        node.parentNode?.removeChild(node);
        destroyNode(node);
        toRemove.push(k);
      }
    }
    for (const k of toRemove) entries.delete(k);
    let cursor = anchor;
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      const k = nextKeys[i];
      let entry = entries.get(k);
      if (!entry) {
        const raw = render(item, i);
        const node = raw instanceof ElementBuilder ? raw.build() : raw;
        const compInstance = instanceRegistry.get(node);
        entry = { node, instance: compInstance };
        entries.set(k, entry);
        cursor.after(entry.node);
        compInstance?._mount();
      } else {
        const expectedNext = cursor.nextSibling;
        if (entry.node !== expectedNext) {
          ;
          cursor.after(entry.node);
        }
      }
      cursor = entry.node;
    }
  }
  const ctx = getCurrentContext();
  if (ctx) {
    const safeCtx = ctx;
    safeCtx.mountCallbacks.push(() => {
      const cleanup = effect(runReconcile);
      safeCtx.effectCleanups.push(cleanup);
    });
  } else {
    effect(runReconcile);
  }
  return anchor;
}
function Show({
  when,
  render,
  fallback
}) {
  const anchor = document.createComment("Show");
  let currentNode = anchor;
  function toNode(result) {
    if (result instanceof ElementBuilder) return { node: result.build() };
    if ("el" in result && "_mount" in result) {
      const ci = result;
      return { node: ci.el, instance: ci };
    }
    return { node: result };
  }
  function swap(next, instance) {
    if (next === currentNode) return;
    if (currentNode !== anchor && currentNode.parentNode) {
      currentNode.parentNode.removeChild(currentNode);
    }
    if (currentNode !== anchor) {
      destroyNode(currentNode);
    }
    if (!next) {
      currentNode = anchor;
      return;
    }
    if (currentNode === anchor) {
      anchor.after(next);
    } else if (anchor.parentNode) {
      anchor.parentNode.insertBefore(next, anchor.nextSibling);
    }
    currentNode = next;
    instance?._mount();
  }
  function runEffect2() {
    const show = when();
    const raw = show ? render() : fallback?.();
    if (!raw) {
      swap(null);
      return;
    }
    const { node, instance } = toNode(raw);
    swap(node, instance);
  }
  const ctx = getCurrentContext();
  if (ctx) {
    const safeCtx = ctx;
    safeCtx.mountCallbacks.push(() => {
      const cleanup = effect(runEffect2);
      safeCtx.effectCleanups.push(cleanup);
    });
  } else {
    effect(runEffect2);
  }
  return anchor;
}

// src/router.ts
var ROUTER_KEY = injectionKey("router");
var ROUTER_VIEW_DEPTH_KEY = injectionKey("router-view-depth");
function pathToRegex(pattern) {
  const keys = [];
  const src = pattern.replace(/\//g, "\\/").replace(/:(\w+)(\*)?(\?)?/g, (_, key, star, opt) => {
    keys.push(key);
    if (star) return "(.*?)";
    if (opt) return "([^\\/]*)?";
    return "([^\\/]+)";
  });
  return { regex: new RegExp(`^${src}\\/?$`), keys };
}
function matchRoute(path, routes, parent = []) {
  for (const route of routes) {
    const fullPattern = parent.length > 0 ? joinPaths(parent.at(-1).path, route.path) : route.path;
    const { regex, keys } = pathToRegex(fullPattern);
    const match = path.match(regex);
    if (match) {
      const params = {};
      keys.forEach((k, i) => {
        const value = match[i + 1];
        if (value !== void 0) params[k] = decodeURIComponent(value);
      });
      const matched = [...parent, route];
      if (route.children?.length) {
        const child = matchRoute(path, route.children, matched);
        if (child) return child;
      }
      return { params, matched };
    }
  }
  return null;
}
function joinPaths(a2, b) {
  return `${a2.replace(/\/$/, "")}/${b.replace(/^\//, "")}`;
}
function parseSearch(search) {
  const q = {};
  new URLSearchParams(search).forEach((v, k) => {
    q[k] = v;
  });
  return q;
}
function buildSearch(query) {
  const p2 = new URLSearchParams(query);
  const s = p2.toString();
  return s ? `?${s}` : "";
}
function getCurrentPath(mode) {
  if (mode === "hash") {
    return decodeURIComponent(window.location.hash.slice(1) || "/");
  }
  return decodeURIComponent(window.location.pathname);
}
function getCurrentQuery() {
  return parseSearch(window.location.search);
}
function getCurrentHash() {
  return window.location.hash;
}
var NOT_FOUND_LOCATION = {
  path: "/404",
  params: {},
  query: {},
  hash: "",
  matched: [],
  meta: {}
};
function createRouter(options) {
  const mode = options.mode ?? "history";
  const beforeEachGuards = options.beforeEach ? [options.beforeEach] : [];
  const afterEachHooks = options.afterEach ? [options.afterEach] : [];
  const nameMap = /* @__PURE__ */ new Map();
  function indexRoutes(routes) {
    for (const r of routes) {
      if (r.name) nameMap.set(r.name, r);
      if (r.children) indexRoutes(r.children);
    }
  }
  indexRoutes(options.routes);
  function buildHref(path, query, hash) {
    const search = buildSearch(query);
    if (mode === "hash") {
      return `${window.location.pathname}${search}#${path}${hash}`;
    }
    return `${path}${search}${hash}`;
  }
  function rawToPath(to) {
    if (typeof to === "string") {
      if (to.startsWith("#")) {
        return {
          path: getCurrentPath(mode),
          query: getCurrentQuery(),
          hash: to
        };
      }
      const url = new URL(to, "http://x");
      return { path: url.pathname, query: parseSearch(url.search), hash: url.hash };
    }
    if ("name" in to) {
      const record = nameMap.get(to.name);
      if (!record) throw new Error(`router: no route named "${to.name}"`);
      let path = record.path;
      for (const [k, v] of Object.entries(to.params ?? {})) {
        path = path.replace(`:${k}`, encodeURIComponent(v));
      }
      return { path, query: to.query ?? {}, hash: to.hash ?? "" };
    }
    return { path: to.path, query: to.query ?? {}, hash: to.hash ?? "" };
  }
  function resolveLocation(path, query, hash, redirectCount = 0) {
    if (redirectCount > 10) {
      console.error("Router: Infinite redirect detected");
      return { ...NOT_FOUND_LOCATION, path, query, hash };
    }
    const match = matchRoute(path, options.routes);
    if (!match) return { ...NOT_FOUND_LOCATION, path, query, hash };
    const record = match.matched.at(-1);
    if (record.redirect) {
      const target = typeof record.redirect === "function" ? record.redirect({ path, params: match.params, query, hash, matched: match.matched, meta: record.meta ?? {} }) : record.redirect;
      const next = rawToPath(target);
      const resolved = resolveLocation(next.path, next.query, next.hash, redirectCount + 1);
      resolved.__redirect = true;
      return resolved;
    }
    return {
      path,
      params: match.params,
      query,
      hash,
      matched: match.matched,
      meta: record.meta ?? {}
    };
  }
  const initialPath = getCurrentPath(mode);
  const initialQuery = getCurrentQuery();
  const initialHash = getCurrentHash();
  const initialRoute = resolveLocation(initialPath, initialQuery, initialHash);
  const current = signal(initialRoute);
  let fromRoute = null;
  async function navigate(to, replace) {
    const { path, query, hash } = rawToPath(to);
    const resolved = resolveLocation(path, query, hash);
    const useReplace = replace || !!resolved.__redirect;
    for (const guard of beforeEachGuards) {
      const result = await guard(resolved, current.peek());
      if (result === false) return;
      if (typeof result === "string") return navigate(result, useReplace);
    }
    const record = resolved.matched.at(-1);
    if (record?.beforeEnter) {
      const result = await record.beforeEnter(resolved, current.peek());
      if (result === false) return;
      if (typeof result === "string") return navigate(result, useReplace);
    }
    fromRoute = current.peek();
    const url = buildHref(path, query, hash);
    if (useReplace) {
      window.history.replaceState({ path, query, hash }, "", url);
    } else {
      window.history.pushState({ path, query, hash }, "", url);
    }
    current.set(resolved);
    for (const hook of afterEachHooks) hook(resolved, fromRoute);
  }
  window.addEventListener("popstate", () => {
    const path = getCurrentPath(mode);
    const query = getCurrentQuery();
    const hash = getCurrentHash();
    fromRoute = current.peek();
    current.set(resolveLocation(path, query, hash));
  });
  if (mode === "history") {
    document.addEventListener("click", (e) => {
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      const anchor = e.target.closest("a");
      if (!anchor) return;
      const target = anchor.getAttribute("target");
      if (target && target !== "_self") return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("http") || href.startsWith("//")) return;
      e.preventDefault();
      navigate(href, false);
    });
  }
  const router = {
    current,
    push: (to) => navigate(to, false),
    replace: (to) => navigate(to, true),
    go: (delta) => window.history.go(delta),
    back: () => window.history.go(-1),
    forward: () => window.history.go(1),
    resolve(to) {
      try {
        const { path, query, hash } = rawToPath(to);
        const location = resolveLocation(path, query, hash);
        if (!location) return null;
        return { ...location, href: buildHref(path, query, hash) };
      } catch {
        return null;
      }
    },
    beforeEach(guard) {
      beforeEachGuards.push(guard);
      return () => {
        const i = beforeEachGuards.indexOf(guard);
        if (i !== -1) beforeEachGuards.splice(i, 1);
      };
    },
    afterEach(hook) {
      afterEachHooks.push(hook);
      return () => {
        const i = afterEachHooks.indexOf(hook);
        if (i !== -1) afterEachHooks.splice(i, 1);
      };
    },
    install(app) {
      app.provide(ROUTER_KEY, router);
    }
  };
  return router;
}
function useRouter() {
  return inject(ROUTER_KEY);
}
function useRoute() {
  return inject(ROUTER_KEY).current;
}
function RouterView() {
  const router = useRouter();
  const route = router.current;
  const parentCtx = getCurrentContext();
  if (!parentCtx) throw new Error("RouterView must be used inside defineComponent setup");
  const depth = inject(ROUTER_VIEW_DEPTH_KEY, 0);
  const anchor = document.createComment("RouterView");
  let currentEl = anchor;
  function swap(next) {
    if (next === currentEl) return;
    if (currentEl === anchor) {
      anchor.after(next);
    } else if (currentEl.parentNode) {
      currentEl.parentNode.replaceChild(next, currentEl);
    }
    if (currentEl !== anchor) {
      destroyNode(currentEl);
    }
    currentEl = next;
  }
  function runRouterEffect() {
    const matched = route().matched;
    const record = matched[depth];
    if (!record) {
      swap(document.createComment("rv-empty"));
      return;
    }
    if (!record.component) {
      console.warn(`RouterView: Route at depth ${depth} ("${record.path}") has no component to render.`);
      swap(document.createComment("rv-empty"));
      return;
    }
    if (!parentCtx) throw new Error("RouterView must be used inside defineComponent setup");
    let instance;
    contextStack.push(parentCtx);
    try {
      provideLocal(ROUTER_VIEW_DEPTH_KEY, depth + 1);
      instance = record.component({
        params: route().params,
        query: route().query,
        meta: route().meta
      });
    } finally {
      contextStack.pop();
    }
    swap(instance.el);
    instance._mount();
  }
  parentCtx.mountCallbacks.push(() => {
    const cleanup = effect(runRouterEffect);
    parentCtx.effectCleanups.push(cleanup);
  });
  return anchor;
}
function RouterLink(props) {
  const router = useRouter();
  const route = router.current;
  const activeClass = props.activeClass ?? "router-link-active";
  const exactActiveClass = props.exactActiveClass ?? "router-link-exact-active";
  const anchor = document.createElement("a");
  if (props.class) {
    anchor.classList.add(...props.class.split(/\s+/).filter(Boolean));
  }
  if (props.children) {
    if (typeof props.children === "string") {
      anchor.textContent = props.children;
    } else {
      anchor.appendChild(props.children);
    }
  }
  anchor.addEventListener("click", (e) => {
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    const to = typeof props.to === "function" ? props.to() : props.to;
    if (props.replace) {
      router.replace(to);
    } else {
      router.push(to);
    }
  });
  if (typeof props.to === "function") {
    const dynamicTo = props.to;
    const cleanup = effect(() => {
      const to = dynamicTo();
      const resolved = router.resolve(to);
      anchor.href = resolved?.href ?? "/";
      const current = route();
      const targetRecord = resolved?.matched.at(-1);
      const isAct = targetRecord ? current.matched.some((r) => r === targetRecord) : false;
      const isExact = resolved ? current.path === resolved.path : false;
      anchor.classList.toggle(activeClass, isAct);
      anchor.classList.toggle(exactActiveClass, isExact);
    });
    registerDestroyHook(anchor, cleanup);
  } else {
    const staticTo = props.to;
    const resolved = router.resolve(staticTo);
    const staticHref = resolved?.href ?? (typeof staticTo === "string" ? staticTo : "/");
    anchor.href = staticHref;
    const targetRecord = resolved?.matched.at(-1);
    const staticPath = resolved?.path;
    const cleanup = effect(() => {
      const current = route();
      const isAct = targetRecord ? current.matched.some((r) => r === targetRecord) : false;
      const isExact = staticPath ? current.path === staticPath : false;
      anchor.classList.toggle(activeClass, isAct);
      anchor.classList.toggle(exactActiveClass, isExact);
    });
    registerDestroyHook(anchor, cleanup);
  }
  return anchor;
}

// src/index.ts
setEffectRunner((fn) => effect(fn));
var VERSION = "0.1.0";
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ElementBuilder,
  For,
  ROUTER_KEY,
  RouterLink,
  RouterView,
  Show,
  VERSION,
  a,
  article,
  batch,
  button,
  computed,
  createApp,
  createEmit,
  createRouter,
  defineComponent,
  destroyNode,
  div,
  effect,
  el,
  footer,
  form,
  fragment,
  getComponentInstance,
  h1,
  h2,
  h3,
  header,
  img,
  inject,
  injectionKey,
  input,
  label,
  li,
  main,
  mount,
  mountComponent,
  nav,
  onDestroy,
  onMount,
  onUpdate,
  option,
  p,
  provideLocal,
  section,
  select,
  setEffectRunner,
  signal,
  span,
  textarea,
  toSignals,
  ul,
  untrack,
  useEffect,
  useRoute,
  useRouter,
  watch
});

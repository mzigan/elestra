import { ElementBuilder, type Signal } from 'elestra';

// Теперь билдер строго типизирован, и мы не теряем IntelliSense
export function ariaExpanded<T extends HTMLElement>(builder: ElementBuilder<T>, stateSignal: Signal<boolean>) {
  return builder.attr('aria-expanded', () => String(stateSignal()));
}

export function ariaControls<T extends HTMLElement>(builder: ElementBuilder<T>, contentId: string) {
  return builder.attr('aria-controls', contentId);
}
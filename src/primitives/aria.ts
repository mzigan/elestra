// primitives/aria.ts
import { type Signal } from '../reactivity';

// Вешаем на триггер
export function ariaExpanded(builder: any, stateSignal: Signal<boolean>) {
  return builder.attr('aria-expanded', () => String(stateSignal()));
}

// Вешаем на контент
export function ariaControls(builder: any, contentId: string) {
  return builder.attr('aria-controls', contentId);
}
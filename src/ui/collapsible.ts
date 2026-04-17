// // ui/collapsible.ts
// import { div, button } from '../element-builder';
// import { createDisclosure } from '../primitives/createDisclosure';
// import { useDismissable } from '../primitives/useDismissable';
// import { ariaExpanded } from '../primitives/aria';
// import { defineComponent } from '../component';

// export const Collapsible = defineComponent((props: {
//   defaultOpen?: boolean,
//   dismissable?: Signal<boolean>
// }, slots) => {
  
//   // 1. Получаем логику
//   const { open, toggle } = createDisclosure(props.defaultOpen);
//   let contentEl: HTMLElement | null = null;

//   // 2. Вешаем DOM-эффект dismiss (если нужно закрывать по клику снаружи)
//   if (props.dismissable) {
//     useDismissable(() => contentEl, {
//       enabled: props.dismissable,
//       onDismiss: () => open.set(false)
//     });
//   }

//   // 3. Собираем UI (только разметка и стили)
//   return div()
//     // Триггер
//     .child(
//       button()
//         .class("flex w-full items-center justify-between rounded-md py-4 font-medium...")
//         .on('click', toggle)
//         .pipe(ariaExpanded(open)) // Магия ARIA в одну строчку
//         .child(slots.trigger?.())
//     )
//     // Контент
//     .child(
//       div()
//         .class(() => `overflow-hidden transition-all duration-200 ${open() ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`)
//         .ref((el) => { contentEl = el; }) // Сохраняем ссылку для useDismissable
//         .attr('data-state', () => open() ? 'open' : 'closed')
//         .child(slots.default?.())
//     );
// });

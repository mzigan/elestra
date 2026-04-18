let idCounter = 0;

export function useId(prefix = 'elestra'): string {
  return `${prefix}-${++idCounter}`;
}

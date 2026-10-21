// Standard browser storage adapter (replaces Lovable iframe broker)
export function brokeredPreviewStorage() {
  if (typeof window === 'undefined') return undefined;
  return window.localStorage;
}

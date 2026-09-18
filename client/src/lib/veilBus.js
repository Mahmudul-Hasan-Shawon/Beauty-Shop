// RouteVeil registers itself here on mount; programmatic navigations
// (search submit, cart drawer, checkout…) can ride the veil too.
export const veilBus = { go: null };

export function veilGo(path, fallback) {
  if (veilBus.go) veilBus.go(path);
  else if (fallback) fallback(path);
}

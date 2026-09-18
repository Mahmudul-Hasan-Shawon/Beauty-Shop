import Lenis from 'lenis';

let lenis = null;

// init once from App — no-op when the user prefers reduced motion
export function initSmooth() {
  if (lenis) return lenis;
  if (typeof window === 'undefined') return null;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
  lenis = new Lenis({
    duration: 1.1,
    smoothWheel: true,
    // inner scroll containers keep their native wheel scrolling — without this,
    // lenis swallows the wheel and the page scrolls instead of e.g. admin tables
    prevent: (node) => !!(node instanceof Element && node.closest(
      '[data-lenis-prevent], .table-scroll, .admin-side, .legal-mtoc-body > nav'
    )),
  });
  const raf = (time) => { lenis.raf(time); requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
  return lenis;
}

export function getLenis() { return lenis; }

export function scrollTop(immediate = true) {
  if (lenis) lenis.scrollTo(0, { immediate });
  else window.scrollTo(0, 0);
}

export function scrollToHash(hash) {
  const el = document.getElementById(String(hash).replace(/^#/, ''));
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { offset: -84 }); // clear the sticky header
  else el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function scrollTopSmooth() {
  if (lenis) lenis.scrollTo(0, { duration: 1.1 });
  else window.scrollTo({ top: 0, behavior: 'smooth' });
}

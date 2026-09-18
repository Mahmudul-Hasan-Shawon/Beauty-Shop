import React, { useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { gsap } from 'gsap';
import { getLenis, scrollTop, scrollToHash } from '../lib/smooth';
import { veilBus } from '../lib/veilBus';

// Full-screen "veil wipe" page transition:
// a brand-gradient panel sweeps up from the bottom, covers the viewport,
// the route swaps underneath, then the panel wipes away to the top.
export default function RouteVeil() {
  const veilRef = useRef(null);
  const busy = useRef(false);
  const navigate = useNavigate();
  const location = useLocation();
  const locRef = useRef(location);
  locRef.current = location;

  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const go = useCallback((target) => {
    const url = new URL(target, window.location.origin);
    const to = url.pathname + url.search + url.hash;

    // same page: in-page anchors smooth-scroll (spec #5); plain/query links just navigate
    if (url.pathname === locRef.current.pathname) {
      if (url.hash) scrollToHash(url.hash);
      else if (url.search !== locRef.current.search) navigate(url.pathname + url.search);
      return;
    }
    if (busy.current) return;

    // reduced motion → instant swap, no veil (spec #4)
    if (reducedMotion()) {
      navigate(to);
      scrollTop(true);
      return;
    }

    const veil = veilRef.current;
    if (!veil) { navigate(to); return; }
    busy.current = true;

    const tl = gsap.timeline({ onComplete: () => { busy.current = false; } });
    tl.set(veil, { visibility: 'visible' });
    // cover: panel rises from the bottom
    tl.fromTo(veil, { clipPath: 'inset(100% 0 0 0)' }, { clipPath: 'inset(0% 0 0 0)', duration: 0.5, ease: 'power4.inOut' });
    // swap the route while covered, jump back to the top
    tl.add(() => {
      navigate(to);
      scrollTop(true);
    });
    // uncover: panel wipes away to the top
    tl.to(veil, { clipPath: 'inset(0 0 100% 0)', duration: 0.55, ease: 'power4.inOut', delay: 0.08 });
    tl.set(veil, { visibility: 'hidden', clipPath: 'inset(100% 0 0 0)' });
  }, [navigate]);

  // capture-phase click interception: internal <a> navigations go through the veil.
  // preventDefault() is enough — react-router's Link checks it and stands down,
  // while other React onClick handlers (closing drawers/menus) still run.
  useEffect(() => {
    const onClick = (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const t = e.target;
      const a = t instanceof Element ? t.closest('a') : null;
      if (!a) return;
      if (a.target === '_blank' || a.hasAttribute('download')) return;
      const href = a.getAttribute('href');
      if (!href || href.startsWith('#')) {
        // bare in-page hash anchors scroll smoothly too
        if (href && href.length > 1) { e.preventDefault(); scrollToHash(href); }
        return;
      }
      let url;
      try { url = new URL(href, window.location.origin); } catch { return; }
      if (url.origin !== window.location.origin) return;
      if (url.pathname.startsWith('/admin')) return; // admin area: no veil
      e.preventDefault();
      go(url.pathname + url.search + url.hash);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [go]);

  // let programmatic navigations ride the veil (search, cart drawer, checkout…)
  useEffect(() => {
    veilBus.go = (t) => go(t);
    return () => { veilBus.go = null; };
  }, [go]);

  return (
    <div className="route-veil" ref={veilRef} aria-hidden="true">
      <span className="route-veil-label">Petal &amp; Rose</span>
    </div>
  );
}

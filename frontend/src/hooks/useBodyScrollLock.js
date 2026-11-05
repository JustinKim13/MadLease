import { useEffect } from 'react';

// Locks background scroll while a modal/overlay is visible. Mobile-only —
// desktop already locks scroll via the app-shell. Saves window.scrollY on
// activation and restores it on release so closing the modal keeps the page
// at the same spot.
export default function useBodyScrollLock(active) {
  useEffect(() => {
    if (!active) return;
    if (!window.matchMedia('(max-width: 768px)').matches) return;

    const scrollY = window.scrollY;
    document.body.style.top = `-${scrollY}px`;
    document.body.classList.add('modal-open');

    return () => {
      document.body.classList.remove('modal-open');
      document.body.style.top = '';
      window.scrollTo(0, scrollY);
    };
  }, [active]);
}

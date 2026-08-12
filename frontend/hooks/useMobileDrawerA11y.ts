import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Rend un tiroir de navigation mobile (`<aside>` en position fixe, ouvert/
 * fermé via `open`) conforme aux attentes de base d'un dialogue accessible :
 * - focus déplacé vers le premier élément focalisable du tiroir à l'ouverture ;
 * - Échap referme le tiroir ;
 * - Tab/Maj+Tab reste piégé à l'intérieur du tiroir tant qu'il est ouvert ;
 * - le focus revient à l'élément qui l'avait avant l'ouverture (le bouton
 *   hamburger) une fois le tiroir refermé.
 *
 * Le composant appelant doit poser `ref={containerRef}`, `role="dialog"`,
 * `aria-modal={open}` et un `aria-label` sur l'élément `<aside>` — ce hook
 * ne gère que le comportement clavier/focus, pas les attributs ARIA
 * eux-mêmes (l'appelant en a besoin même quand `open` est faux, pour le SSR).
 */
export function useMobileDrawerA11y<T extends HTMLElement>(
  open: boolean,
  onClose: () => void,
) {
  const containerRef = useRef<T>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      previouslyFocused.current = document.activeElement as HTMLElement | null;
      const firstFocusable =
        containerRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      firstFocusable?.focus();
    } else {
      previouslyFocused.current?.focus();
      previouslyFocused.current = null;
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !containerRef.current) return;

      const focusables = Array.from(
        containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  return containerRef;
}

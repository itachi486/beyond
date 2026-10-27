import { useLayoutEffect, useRef, type ReactNode } from "react";
import { Icon } from "./Icon";
export function Overlay({
  title,
  onClose,
  children,
  closeLabel,
  toolbar,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  closeLabel: string;
  toolbar?: ReactNode;
}) {
  const box = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useLayoutEffect(() => {
    const old = document.activeElement as HTMLElement | null;
    box.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close.current();
      }
      if (e.key === "Tab") {
        const focusable = box.current?.querySelectorAll<HTMLElement>(
          'button, a, input, select, [tabindex="0"]',
        );
        if (!focusable?.length) return;
        const first = focusable[0],
          last = focusable[focusable.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === box.current)
        ) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      old?.focus();
    };
  }, []);
  return (
    <div className="overlay-shade" onClick={onClose}>
      <section
        ref={box}
        className="overlay"
        data-overlay
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="overlay-header">
          <span className="eyebrow">BEYOND / {title}</span>
          <div className="overlay-tools">
            {toolbar}
            <button
              className="icon-button"
              aria-label={closeLabel}
              onClick={onClose}
            >
              <Icon name="close" />
            </button>
          </div>
        </header>
        {children}
      </section>
    </div>
  );
}

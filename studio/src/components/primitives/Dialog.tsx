import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Morph, usePresence } from "./motion";
export function Dialog({
  title,
  children,
  onClose,
  open,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  open: boolean;
}) {
  const { mounted, visible } = usePresence(open),
    id = useId();
  const panel = useRef<HTMLDivElement>(null),
    close = useRef(onClose);
  close.current = onClose;
  const retained = useRef({ title, children });
  if (open) retained.current = { title, children };
  useEffect(() => {
    if (!mounted) return;
    const previous = document.activeElement as HTMLElement | null;
    const app = document.querySelector<HTMLElement>(".app");
    const wasInert = app?.inert ?? false;
    if (app) app.inert = true;
    panel.current?.focus({ preventScroll: true });
    const keys = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close.current();
      }
      if (e.key === "Tab") {
        const items = Array.from(
          panel.current?.querySelectorAll<HTMLElement>(
            'a[href],button:not(:disabled),input:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
          ) ?? [],
        ).filter((n) => !n.closest("[inert]") && n.getClientRects().length > 0);
        const first = items[0],
          last = items.at(-1),
          current = document.activeElement;
        if (!panel.current?.contains(current)) {
          e.preventDefault();
          first?.focus();
        } else if (!first) {
          e.preventDefault();
          panel.current?.focus();
        } else if (
          e.shiftKey &&
          (current === first || current === panel.current)
        ) {
          e.preventDefault();
          last?.focus();
        } else if (
          !e.shiftKey &&
          (current === last || current === panel.current)
        ) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", keys);
    return () => {
      document.removeEventListener("keydown", keys);
      if (app) app.inert = wasInert;
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [mounted]);
  if (!mounted) return null;
  return createPortal(
    <div
      className="modal-layer"
      data-visible={visible}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) close.current();
      }}
    >
      <div
        ref={panel}
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        tabIndex={-1}
        inert={!open}
      >
        <div className="dialog-heading">
          <h2 id={id}>
            <Morph motionKey={retained.current.title}>
              {retained.current.title}
            </Morph>
          </h2>
          <button className="icon-button" aria-label="閉じる" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="dialog-body">
          <Morph motionKey={retained.current.title}>
            {retained.current.children}
          </Morph>
        </div>
      </div>
    </div>,
    document.body,
  );
}

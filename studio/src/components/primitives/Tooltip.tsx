import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { usePresence } from "./motion";
export function Tooltip({
  open,
  label,
  anchor,
}: {
  open: boolean;
  label: string;
  anchor: RefObject<HTMLButtonElement | null>;
}) {
  const { mounted, visible } = usePresence(open),
    id = useId(),
    tip = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  useLayoutEffect(() => {
    if (!mounted || !anchor.current || !tip.current) return;
    const r = anchor.current.getBoundingClientRect(),
      t = tip.current.getBoundingClientRect();
    setPosition({
      left: Math.max(
        8,
        Math.min(innerWidth - t.width - 8, r.left + (r.width - t.width) / 2),
      ),
      top:
        r.bottom + t.height + 12 < innerHeight
          ? r.bottom + 6
          : Math.max(8, r.top - t.height - 6),
    });
  }, [mounted, label, anchor]);
  return mounted
    ? createPortal(
        <div
          ref={tip}
          id={id}
          role="tooltip"
          className="tooltip"
          data-visible={visible}
          style={position}
        >
          {label}
        </div>,
        document.body,
      )
    : null;
}

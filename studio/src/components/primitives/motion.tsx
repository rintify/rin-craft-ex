import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

export const UI_DURATION = 240;
export const UI_EASING = "cubic-bezier(.2,.8,.2,1)";

/** Keep the departing surface mounted until its exit transition finishes. */
export function usePresence(open: boolean) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    let first = 0,
      second = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (open) {
      setMounted(true);
      first = requestAnimationFrame(() => {
        second = requestAnimationFrame(() => setVisible(true));
      });
    } else {
      setVisible(false);
      timer = setTimeout(() => setMounted(false), UI_DURATION);
    }
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
      clearTimeout(timer);
    };
  }, [open]);
  return { mounted, visible };
}

export function Presence({
  show,
  children,
  className = "",
}: {
  show: boolean;
  children: ReactNode;
  className?: string;
}) {
  const { mounted, visible } = usePresence(show);
  const retained = useRef(children);
  if (show) retained.current = children;
  return mounted ? (
    <div
      className={`presence ${className}`}
      data-visible={visible}
      inert={!show}
      aria-hidden={!show}
    >
      {retained.current}
    </div>
  ) : null;
}

/** A visual-only snapshot allows even store-connected content to crossfade.
 * The outgoing copy is inert, inaccessible, and owns no React state or handlers.
 */
export function Morph({
  motionKey,
  children,
  className = "",
}: {
  motionKey: string | number;
  children: ReactNode;
  className?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const previous = useRef<HTMLElement | null>(null);
  const previousHeight = useRef(0);
  useLayoutEffect(() => {
    const node = content.current!,
      container = host.current!;
    const old = previous.current;
    const height = node.getBoundingClientRect().height;
    const oldHeight = previousHeight.current;
    previousHeight.current = height;
    previous.current = node.cloneNode(true) as HTMLElement;
    const animations: Animation[] = [];
    if (old) {
      old.classList.add("motion-ghost");
      old.inert = true;
      old.setAttribute("aria-hidden", "true");
      old.removeAttribute("id");
      old.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
      container.appendChild(old);
      const options = {
        duration: UI_DURATION,
        easing: UI_EASING,
        fill: "both" as const,
      };
      if (Math.abs(oldHeight - height) > 1)
        animations.push(
          container.animate(
            [{ height: `${oldHeight}px` }, { height: `${height}px` }],
            { ...options, fill: "none" },
          ),
        );
      animations.push(old.animate([{ opacity: 1 }, { opacity: 0 }], options));
      animations.push(
        node.animate(
          [
            { opacity: 0, transform: "translateY(4px)" },
            { opacity: 1, transform: "translateY(0)" },
          ],
          options,
        ),
      );
    }
    const timer = setTimeout(() => old?.remove(), UI_DURATION);
    return () => {
      clearTimeout(timer);
      animations.forEach((a) => a.cancel());
      old?.remove();
    };
  }, [motionKey]);
  return (
    <div ref={host} className={`morph ${className}`}>
      <div ref={content}>{children}</div>
    </div>
  );
}

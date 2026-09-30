import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Plus, Minus, Move } from "lucide-react";
import type { Vec2 } from "../core/types";
/** One spring control owns capture and its animation loop, including cancellation. */
export function NavigationStick({
  kind,
  onFrame,
  enabled = true,
}: {
  enabled?: boolean;
  kind: "orbit" | "zoom";
  onFrame: (direction: Vec2, seconds: number) => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    active = useRef<number | null>(null),
    direction = useRef<Vec2>([0, 0]),
    frame = useRef(0),
    previous = useRef(0),
    callback = useRef(onFrame);
  callback.current = onFrame;
  const [offset, setOffset] = useState<Vec2>([0, 0]);
  const stop = () => {
    cancelAnimationFrame(frame.current);
    direction.current = [0, 0];
    const id = active.current;
    active.current = null;
    if (id !== null && host.current?.hasPointerCapture(id))
      host.current.releasePointerCapture(id);
    setOffset([0, 0]);
  };
  const animate = (time: number) => {
    const dt = Math.min(0.1, Math.max(0, (time - previous.current) / 1000));
    previous.current = time;
    callback.current(direction.current, dt);
    frame.current = requestAnimationFrame(animate);
  };
  const start = () => {
    cancelAnimationFrame(frame.current);
    previous.current = performance.now();
    frame.current = requestAnimationFrame(animate);
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (active.current !== e.pointerId) return;
    const r = e.currentTarget.getBoundingClientRect(),
      x = e.clientX - r.left - r.width / 2,
      y = e.clientY - r.top - r.height / 2;
    if (kind === "zoom") {
      const v = Math.max(-1, Math.min(1, -y / (r.height / 2)));
      direction.current = [0, v];
      setOffset([0, -v * (r.height / 2 - 20)]);
    } else {
      const length = Math.hypot(x, y),
        radius = r.width / 2 - 22,
        ratio = Math.min(1, radius / (length || 1));
      const strength = Math.max(0, Math.min(1, (length - 2) / (radius - 2)));
      direction.current =
        length > 2
          ? [(x / length) * strength, (-y / length) * strength]
          : [0, 0];
      setOffset([x * ratio, y * ratio]);
    }
  };
  useEffect(() => {
    if (!enabled) stop();
  }, [enabled]);
  useEffect(() => {
    const hidden = () => {
      if (document.hidden) stop();
    };
    window.addEventListener("blur", stop);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      cancelAnimationFrame(frame.current);
      window.removeEventListener("blur", stop);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, []);
  return (
    <div
      className={`navigation-stick ${kind}-stick`}
      ref={host}
      data-held={offset[0] !== 0 || offset[1] !== 0}
      role="button"
      tabIndex={enabled ? 0 : -1}
      aria-label={
        kind === "orbit" ? "視点の回転スティック" : "拡大・縮小スティック"
      }
      aria-description={
        kind === "orbit"
          ? "押したまま動かして視点を回転。離すと停止。"
          : "上に動かすと拡大、下に動かすと縮小。離すと停止。"
      }
      onPointerDown={(e) => {
        if (!enabled || active.current !== null || e.button !== 0) return;
        e.preventDefault();
        active.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        move(e);
        start();
      }}
      onPointerMove={move}
      onPointerUp={(e) => {
        if (e.pointerId === active.current) stop();
      }}
      onPointerCancel={stop}
      onLostPointerCapture={stop}
      onBlur={stop}
      onKeyDown={(e) => {
        const keys: Record<string, Vec2> = {
          ArrowLeft: [-1, 0],
          ArrowRight: [1, 0],
          ArrowUp: [0, 1],
          ArrowDown: [0, -1],
        };
        if (keys[e.key]) {
          e.preventDefault();
          direction.current = keys[e.key];
          if (!e.repeat) start();
        }
      }}
      onKeyUp={stop}
    >
      {kind === "zoom" ? (
        <>
          <Plus className="stick-plus" size={20} />
          <Minus className="stick-minus" size={20} />
        </>
      ) : (
        <span className="stick-cross" />
      )}
      <span
        className="stick-knob"
        style={{ transform: `translate(${offset[0]}px,${offset[1]}px)` }}
      >
        {kind === "orbit" ? <Move size={18} /> : <span />}
      </span>
      <span className="stick-label">
        {kind === "orbit" ? "回転" : "ズーム"}
      </span>
    </div>
  );
}

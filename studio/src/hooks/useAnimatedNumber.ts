import { useEffect, useRef, useState } from "react";
/** Exponential following is continuous even when a target changes mid-animation. */
export function useAnimatedNumber(target: number, settling = 70) {
  const [value, setValue] = useState(target),
    current = useRef(target);
  useEffect(() => {
    let frame = 0,
      previous = performance.now();
    const tick = (now: number) => {
      const alpha = 1 - Math.exp(-(now - previous) / settling);
      previous = now;
      current.current += (target - current.current) * alpha;
      if (Math.abs(target - current.current) < 0.001) current.current = target;
      setValue(current.current);
      if (current.current !== target) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, settling]);
  return value;
}

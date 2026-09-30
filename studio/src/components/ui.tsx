import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { Tooltip } from "./primitives/Tooltip";
import { ChevronDown } from "lucide-react";
export { Dialog } from "./primitives/Dialog";
export { Select } from "./primitives/Select";
export { Morph, Presence } from "./primitives/motion";
export function IconButton({
  label,
  active,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  active?: boolean;
}) {
  const anchor = useRef<HTMLButtonElement>(null);
  const [hovered, setHovered] = useState(false),
    [tip, setTip] = useState(false);
  useEffect(() => {
    if (!hovered) {
      setTip(false);
      return;
    }
    const timer = setTimeout(() => setTip(true), 500);
    return () => clearTimeout(timer);
  }, [hovered]);
  return (
    <>
      <button
        {...props}
        ref={anchor}
        className={`icon-button ${active ? "active" : ""} ${props.className ?? ""}`}
        aria-label={label}
        aria-pressed={active}
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse") setHovered(true);
          props.onPointerEnter?.(e);
        }}
        onPointerLeave={(e) => {
          setHovered(false);
          props.onPointerLeave?.(e);
        }}
        onPointerDown={(e) => {
          setHovered(false);
          props.onPointerDown?.(e);
        }}
        onFocus={(e) => {
          if (e.currentTarget.matches(":focus-visible")) setHovered(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setHovered(false);
          props.onBlur?.(e);
        }}
      >
        {children}
      </button>
      <Tooltip anchor={anchor} open={tip} label={label} />
    </>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  min = -100000,
  max = 100000,
  step = 1,
  unit,
  axis,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  axis?: string;
}) {
  const format = (v: number) => String(Number(v.toFixed(2)));
  const [draft, setDraft] = useState(format(value));
  useEffect(() => setDraft(format(value)), [value]);
  const cancelled = useRef(false);
  const commit = () => {
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    const number = Number(draft);
    if (draft.trim() && Number.isFinite(number) && number !== value)
      onChange(Math.min(max, Math.max(min, number)));
    setDraft(format(value));
  };
  return (
    <label className={`number-field ${axis ? "axis-field" : ""}`}>
      {axis ? (
        <span className={`axis-label axis-${axis}`}>{axis.toUpperCase()}</span>
      ) : (
        <span>{label}</span>
      )}
      <div>
        <input
          aria-label={label}
          type="text"
          inputMode={min < 0 ? "text" : "decimal"}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              e.stopPropagation();
              cancelled.current = true;
              setDraft(format(value));
              e.currentTarget.blur();
            }
            if (e.key === "ArrowUp" || e.key === "ArrowDown") {
              e.preventDefault();
              setDraft(
                format(
                  Math.min(
                    max,
                    Math.max(
                      min,
                      (Number(draft) || 0) +
                        (e.key === "ArrowUp" ? step : -step),
                    ),
                  ),
                ),
              );
            }
          }}
        />
        {unit && <span className="unit">{unit}</span>}
      </div>
    </label>
  );
}
export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="toggle-row">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-label={label}
        aria-checked={checked}
        className="switch"
        onClick={() => onChange(!checked)}
      >
        <span />
      </button>
    </div>
  );
}
export function Accordion({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false),
    id = useId();
  return (
    <div className="accordion" data-open={open}>
      <button
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        {title}
        <ChevronDown size={16} />
      </button>
      <div
        id={id}
        className="accordion-collapse"
        inert={!open}
        aria-hidden={!open}
      >
        <div>
          <div className="accordion-content">{children}</div>
        </div>
      </div>
    </div>
  );
}
export function Segmented({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: ReactNode }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      <span
        className="segment-indicator"
        style={{
          width: `${100 / options.length}%`,
          transform: `translateX(${
            Math.max(
              0,
              options.findIndex((o) => o.value === value),
            ) * 100
          }%)`,
        }}
      />
      {options.map((o) => (
        <button
          key={o.value}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

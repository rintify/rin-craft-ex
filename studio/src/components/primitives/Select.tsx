import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { usePresence } from "./motion";
export interface SelectOption {
  value: string;
  label: string;
}
export function Select({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false),
    [active, setActive] = useState(0);
  const [placement, setPlacement] = useState({
    left: 0,
    top: 0,
    width: 180,
    maxHeight: 260,
  });
  const trigger = useRef<HTMLButtonElement>(null),
    popup = useRef<HTMLDivElement>(null);
  const id = useId(),
    { mounted, visible } = usePresence(open);
  const search = useRef({ text: "", time: 0 });
  const selected = options.findIndex((o) => o.value === value);
  const show = () => {
    setActive(Math.max(0, selected));
    setOpen(true);
  };
  const choose = (index: number) => {
    const option = options[index];
    if (option) onChange(option.value);
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  };
  useLayoutEffect(() => {
    if (!mounted) return;
    const place = () => {
      const r = trigger.current!.getBoundingClientRect();
      const width = Math.min(Math.max(r.width, 190), window.innerWidth - 16);
      const below = window.innerHeight - r.bottom - 12,
        above = r.top - 12;
      const height = Math.min(
        options.length * 44 + 8,
        280,
        Math.max(below, above),
      );
      setPlacement({
        left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)),
        top: below >= height ? r.bottom + 5 : r.top - height - 5,
        width,
        maxHeight: height,
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    const outside = (e: PointerEvent) => {
      if (
        !popup.current?.contains(e.target as Node) &&
        !trigger.current?.contains(e.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      document.removeEventListener("pointerdown", outside);
    };
  }, [mounted, options.length]);
  useEffect(() => {
    popup.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [active, open]);
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="select-trigger"
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        aria-haspopup="listbox"
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : show())}
        onBlur={(e) => {
          if (!popup.current?.contains(e.relatedTarget)) setOpen(false);
        }}
        onKeyDown={(e) => {
          if (
            [
              "ArrowDown",
              "ArrowUp",
              "Home",
              "End",
              "Enter",
              " ",
              "Escape",
            ].includes(e.key)
          ) {
            e.preventDefault();
            e.stopPropagation();
            if (e.key === "Escape") {
              setOpen(false);
              return;
            }
            if (!open) {
              show();
              return;
            }
            if (e.key === "Enter" || e.key === " ") choose(active);
            else
              setActive((i) =>
                e.key === "Home"
                  ? 0
                  : e.key === "End"
                    ? options.length - 1
                    : (i + (e.key === "ArrowDown" ? 1 : -1) + options.length) %
                      options.length,
              );
          } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
            e.stopPropagation();
            const now = performance.now();
            search.current = {
              text:
                (now - search.current.time < 600 ? search.current.text : "") +
                e.key.toLowerCase(),
              time: now,
            };
            const index = options.findIndex((o) =>
              o.label.toLowerCase().startsWith(search.current.text),
            );
            if (!open) show();
            if (index >= 0) setActive(index);
          } else if (e.key === "Tab") setOpen(false);
        }}
      >
        <span>{options[selected]?.label ?? label}</span>
        <ChevronDown size={15} className={open ? "turned" : ""} />
      </button>
      {mounted &&
        createPortal(
          <div
            ref={popup}
            id={id}
            role="listbox"
            aria-label={label}
            className="select-popup"
            data-visible={visible}
            style={placement}
            inert={!open}
            aria-hidden={!open}
          >
            {options.map((option, index) => (
              <div
                key={option.value}
                id={`${id}-${index}`}
                role="option"
                aria-selected={value === option.value}
                data-index={index}
                className={`select-option ${active === index ? "highlighted" : ""}`}
                onPointerMove={() => setActive(index)}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => choose(index)}
              >
                <span>{option.label}</span>
                <Check
                  size={16}
                  style={{ opacity: value === option.value ? 1 : 0 }}
                />
              </div>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}

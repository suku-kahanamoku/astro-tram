import {
  useState,
  useEffect,
  useRef,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
} from "react";
export interface ComboOption {
  key: string;
  label: string;
  detail?: string;
}
interface Props extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "onChange" | "onSelect" | "value"
> {
  value: string;
  options: ComboOption[];
  open: boolean;
  listId: string;
  onText: (text: string) => void;
  onChoose: (index: number) => void;
  onDismiss: () => void;
  inputRef?: Ref<HTMLInputElement>;
  buttons?: ReactNode;
  hint?: string;
  hintAttributes?: Record<string, string>;
}
export default function Combobox({
  value,
  options,
  open,
  listId,
  onText,
  onChoose,
  onDismiss,
  inputRef,
  buttons,
  hint,
  hintAttributes,
  onKeyDown,
  ...props
}: Props) {
  const [active, setActive] = useState(-1);
  const [visibleCount, setVisibleCount] = useState(100);
  useEffect(() => {
    setVisibleCount(100);
    setActive(-1);
  }, [value, open, options]);
  const list = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (!open) setActive(-1);
    if (open && active >= 0) {
      list.current?.children[active]?.scrollIntoView({ block: "nearest" });
    }
  }, [open, active]);
  return (
    <>
      <div className="place-input">
        <input
          {...props}
          ref={inputRef}
          value={value}
          role="combobox"
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={open && options.length > 0}
          aria-activedescendant={
            open && active >= 0 && active < options.length
              ? `${listId}-${active}`
              : undefined
          }
          onChange={(e) => {
            setActive(-1);
            onText(e.target.value);
          }}
          onKeyDown={(e) => {
            onKeyDown?.(e);
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              onDismiss();
              setActive(-1);
            }
            if (!open || !options.length) return;
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              const next =
                (active + (e.key === "ArrowDown" ? 1 : -1) + options.length) %
                options.length;
              setVisibleCount((count) => Math.max(count, next + 1));
              setActive(next);
            }
            if (e.key === "Enter") {
              e.preventDefault();
              if (active >= 0 && active < options.length) onChoose(active);
            }
          }}
        />
        {buttons}
      </div>
      {open && options.length > 0 && (
        <ul
          id={listId}
          ref={list}
          className="suggestions"
          role="listbox"
          onMouseDown={(e) => e.preventDefault()}
          onScroll={(e) => {
            const list = e.currentTarget;
            if (list.scrollHeight - list.scrollTop - list.clientHeight < 80)
              setVisibleCount((count) => Math.min(options.length, count + 100));
          }}
        >
          {options.slice(0, visibleCount).map((option, i) => (
            <li
              key={option.key}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={active === i}
              aria-setsize={options.length}
              aria-posinset={i + 1}
              onClick={() => {
                setActive(-1);
                onChoose(i);
              }}
            >
              {option.label}
              {option.detail && <small>{option.detail}</small>}
            </li>
          ))}
        </ul>
      )}
      {hint && (
        <p className="field-hint" {...hintAttributes} role="status">
          {hint}
        </p>
      )}
    </>
  );
}

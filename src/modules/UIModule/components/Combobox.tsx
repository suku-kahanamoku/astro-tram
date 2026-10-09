import {
  useState,
  useEffect,
  useRef,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
} from "react";
import {
  dismissMobileKeyboard,
  isKeyboardScrollDismissal,
  usesTouchKeyboard,
} from "../providers/mobileKeyboard";
export interface ComboOption {
  key: string;
  label: string;
  detail?: string;
  icon?: ReactNode;
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
  onBlur,
  ...props
}: Props) {
  const [active, setActive] = useState(-1);
  const [visibleCount, setVisibleCount] = useState(100);
  useEffect(() => {
    setVisibleCount(100);
    setActive(-1);
  }, [value, open, options]);
  const list = useRef<HTMLUListElement>(null);
  const choose = (index: number) => {
    onChoose(index);
    dismissMobileKeyboard();
  };
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !list.current?.parentElement?.contains(event.target)
      )
        onDismiss();
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open, onDismiss]);
  useEffect(() => {
    if (!open) setActive(-1);
    if (open && active >= 0) {
      list.current?.children[active]?.scrollIntoView({ block: "nearest" });
    } else if (open && list.current && !usesTouchKeyboard()) {
      const bounds = list.current.getBoundingClientRect();
      if (bounds.bottom > window.innerHeight || bounds.top < 0)
        list.current.scrollIntoView({ block: "nearest" });
    }
  }, [open, active, options.length]);
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
          onBlur={(event) => {
            // Keep a touch-scrolled list available after hiding the keyboard.
            if (!isKeyboardScrollDismissal()) onBlur?.(event);
          }}
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
            if (e.key === "Enter" && active >= 0 && active < options.length) {
              e.preventDefault();
              choose(active);
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
              aria-label={option.label}
              aria-describedby={
                option.detail ? `${listId}-${i}-detail` : undefined
              }
              className={option.icon ? "combo-rich-option" : undefined}
              aria-setsize={options.length}
              aria-posinset={i + 1}
              onClick={() => {
                setActive(-1);
                choose(i);
              }}
            >
              {option.icon && <span aria-hidden="true">{option.icon}</span>}
              <span className="combo-option-text">
                <span className="combo-option-label">{option.label}</span>
                {option.detail && (
                  <small id={`${listId}-${i}-detail`}>{option.detail}</small>
                )}
              </span>
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

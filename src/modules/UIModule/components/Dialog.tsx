import "../styles/motion.css";
import "../styles/dialog.css";
import Icon from "./TransitIcon";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type DialogHTMLAttributes,
} from "react";

export type DialogProps = Omit<
  DialogHTMLAttributes<HTMLDialogElement>,
  "open" | "title" | "aria-labelledby"
> & {
  open: boolean;
  onDismiss: () => void;
  title: ReactNode;
  titleId?: string;
  titleClassName?: string;
  headerContent?: ReactNode;
  scrollContent?: boolean;
  closeLabel: string;
  closeButtonAttributes?: { [name: `data-${string}`]: string | boolean };
  children: ReactNode;
};

/** Shared modal shell, native focus trapping, restoration and backdrop dismissal. */
export default function Dialog({
  open,
  onDismiss,
  title,
  titleId,
  titleClassName,
  headerContent,
  scrollContent = false,
  closeLabel,
  closeButtonAttributes,
  className,
  children,
  ...props
}: DialogProps) {
  const generatedId = useId();
  const headingId = titleId ?? generatedId;
  const panel = (
    <>
      <header className="ui-dialog-header">
        <div className="ui-dialog-heading">
          <h2 id={headingId} className={titleClassName}>
            {title}
          </h2>
          {headerContent}
        </div>
        <button
          {...closeButtonAttributes}
          className="ui-dialog-close"
          type="button"
          data-dialog-close
          aria-label={closeLabel}
          onClick={onDismiss}
        >
          <Icon name="close" size={25} />
        </button>
      </header>
      {scrollContent ? (
        <div
          className="ui-dialog-content"
          role="region"
          aria-labelledby={headingId}
          tabIndex={0}
        >
          {children}
        </div>
      ) : (
        children
      )}
    </>
  );
  const [present, setPresent] = useState(open);
  useEffect(() => {
    if (open) {
      setPresent(true);
      return;
    }
    let cancelled = false;
    // The close effect below starts native exit animations during this commit.
    queueMicrotask(() => {
      const animations = ref.current?.getAnimations() ?? [];
      void Promise.allSettled(
        animations.map((animation) => animation.finished),
      ).then(() => {
        if (!cancelled) {
          setPresent(false);
          content.current = null;
        }
      });
    });
    return () => {
      cancelled = true;
    };
  }, [open]);
  const ref = useRef<HTMLDialogElement>(null);
  const content = useRef<ReactNode>(panel);
  const opener = useRef<HTMLElement | null>(null);
  const backdropDown = useRef(false);
  if (open) content.current = panel;
  useEffect(() => {
    const dialog = ref.current!;
    if (open && !dialog.open) {
      const active = document.activeElement;
      opener.current =
        active instanceof HTMLElement &&
        active !== document.body &&
        active !== document.documentElement &&
        active.getAttribute("aria-haspopup") === "dialog"
          ? active
          : null;
      const trigger = opener.current?.getBoundingClientRect();
      dialog.showModal();
      const bounds = dialog.getBoundingClientRect();
      dialog.style.transformOrigin = "center";
      if (trigger && trigger.width) {
        const x = Math.max(
          0,
          Math.min(bounds.width, trigger.x + trigger.width / 2 - bounds.x),
        );
        const y = Math.max(
          0,
          Math.min(bounds.height, trigger.y + trigger.height / 2 - bounds.y),
        );
        dialog.style.transformOrigin = `${x}px ${y}px`;
      }
    } else if (!open && dialog.open) {
      dialog.close();
      const target = opener.current;
      queueMicrotask(() => {
        if (!dialog.open && target?.isConnected && !target.closest("[inert]"))
          target.focus({ preventScroll: true });
      });
    }
  }, [open]);
  const outside = (e: React.PointerEvent<HTMLDialogElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return (
      e.target === e.currentTarget &&
      (e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom)
    );
  };
  return (
    <dialog
      {...props}
      className={[
        "ui-dialog",
        scrollContent && "ui-dialog--scroll-content",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-labelledby={headingId}
      ref={ref}
      onPointerDown={(e) => {
        backdropDown.current = outside(e);
      }}
      onPointerCancel={() => {
        backdropDown.current = false;
      }}
      onPointerUp={(e) => {
        if (backdropDown.current && outside(e)) onDismiss();
        backdropDown.current = false;
      }}
      onCancel={(e) => {
        e.preventDefault();
        onDismiss();
      }}
    >
      {open ? panel : present ? content.current : null}
    </dialog>
  );
}

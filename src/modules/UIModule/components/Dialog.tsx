import "../styles/motion.css";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type DialogHTMLAttributes,
} from "react";

/** Native focus trapping and restoration, with backdrop-only dismissal. */
export default function Dialog({
  open,
  onDismiss,
  children,
  ...props
}: Omit<DialogHTMLAttributes<HTMLDialogElement>, "open"> & {
  open: boolean;
  onDismiss: () => void;
  children: ReactNode;
}) {
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
  const content = useRef(children);
  const opener = useRef<HTMLElement | null>(null);
  const backdropDown = useRef(false);
  if (open) content.current = children;
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
      {open ? children : present ? content.current : null}
    </dialog>
  );
}

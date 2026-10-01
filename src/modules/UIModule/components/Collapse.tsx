import "../styles/motion.css";
import {
  useLayoutEffect,
  useRef,
  useState,
  useEffect,
  type ReactNode,
} from "react";

/** Animate both disclosure and asynchronous content height, without reloading children. */
export default function Collapse({
  open,
  children,
}: {
  open: boolean;
  children: ReactNode;
}) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const animation = useRef<Animation | null>(null);
  const height = useRef(0);
  const content = useRef<ReactNode>(open ? children : null);
  const [present, setPresent] = useState(open);
  useEffect(() => {
    if (open) {
      setPresent(true);
      return;
    }
    const timer = setTimeout(() => {
      setPresent(false);
      content.current = null;
    }, 220);
    return () => clearTimeout(timer);
  }, [open]);
  if (open) content.current = children;
  useLayoutEffect(() => {
    const wrapper = outer.current!,
      body = inner.current!;
    const resize = () => {
      const next = open ? body.getBoundingClientRect().height : 0;
      if (next === height.current) return;
      const previous = wrapper.getBoundingClientRect().height;
      animation.current?.cancel();
      wrapper.style.height = `${next}px`;
      height.current = next;
      if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
        animation.current = wrapper.animate(
          [{ height: `${previous}px` }, { height: `${next}px` }],
          { duration: 220, easing: "cubic-bezier(.2,.8,.2,1)" },
        );
      }
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(body);
    return () => observer.disconnect();
  }, [open]);
  return (
    <div
      ref={outer}
      className="disclosure-motion"
      inert={!open}
      aria-hidden={!open}
    >
      <div ref={inner}>
        {open ? children : present ? content.current : null}
      </div>
    </div>
  );
}

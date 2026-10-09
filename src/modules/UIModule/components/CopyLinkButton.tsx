import { useRef, useState, type ButtonHTMLAttributes } from "react";
import Icon from "./TransitIcon";
import { notify } from "../providers/notifications";
export default function CopyLinkButton({
  label,
  copied,
  error,
  errorHelp,
  ...props
}: {
  label: string;
  copied: string;
  error: string;
  errorHelp?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const [copying, setCopying] = useState(false);
  const pending = useRef(false);
  return (
    <button
      {...props}
      type="button"
      disabled={copying || props.disabled}
      aria-label={label}
      title={label}
      onClick={async () => {
        if (pending.current) return;
        pending.current = true;
        setCopying(true);
        try {
          await navigator.clipboard.writeText(location.href);
          notify(copied, "success");
        } catch {
          notify(error, "error", errorHelp);
        } finally {
          pending.current = false;
          setCopying(false);
        }
      }}
    >
      <Icon name="copy" size={18} />
      <span className="share-label">{label}</span>
    </button>
  );
}

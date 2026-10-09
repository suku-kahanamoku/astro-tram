import { useEffect } from "react";
import { Toaster } from "sonner";
import { mountNotifications } from "../providers/notifications";
import "../styles/notifications.css";

/** One global host; callers provide localized copy without coupling UI to languages. */
export default function ToastViewport({
  label,
  closeLabel,
}: {
  label: string;
  closeLabel: string;
}) {
  useEffect(mountNotifications, []);
  return (
    <Toaster
      position="bottom-right"
      visibleToasts={1}
      closeButton
      customAriaLabel={label}
      containerAriaLabel={label}
      className="app-toaster"
      offset={24}
      mobileOffset={{
        bottom: "max(16px, env(safe-area-inset-bottom))",
        left: 16,
        right: 16,
      }}
      toastOptions={{
        className: "app-toast",
        closeButtonAriaLabel: closeLabel,
      }}
    />
  );
}

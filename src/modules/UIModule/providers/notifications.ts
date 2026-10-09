import { toast } from "sonner";

type Notification = {
  message: string;
  kind: "success" | "error" | "info";
  description?: string;
};
const id = "app-notification";
let ready = false;
let pending: Notification | undefined;
let latest: Notification | undefined;

const show = ({ message, kind, description }: Notification) =>
  toast[kind](message, {
    id,
    description,
    duration: kind === "error" ? 6000 : 4000,
  });

/** One replaceable notification; never build a queue of background messages. */
export function notify(
  message: string,
  kind: Notification["kind"] = "info",
  description?: string,
) {
  if (typeof window === "undefined") return;
  const notification = { message, kind, description };
  latest = notification;
  if (ready) show(notification);
  else pending = notification;
  // A finished/aborted action may clear its own message, never a newer one.
  return () => {
    if (latest !== notification) return;
    latest = undefined;
    pending = undefined;
    if (ready) toast.dismiss(id);
  };
}

/** Astro islands hydrate independently: retain the latest message until the host subscribes. */
export function mountNotifications() {
  ready = true;
  if (pending) {
    show(pending);
    pending = undefined;
  }
  return () => {
    ready = false;
    pending = undefined;
    latest = undefined;
    toast.dismiss(id);
  };
}

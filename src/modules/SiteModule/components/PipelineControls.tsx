import { useEffect, useRef, useState } from "react";
import type { PipelineAction, PipelineState } from "../types";
import { dictionary } from "../providers/translations";
import { url, type Locale } from "../../../config/routes";
import "../styles/pipeline.css";

export default function PipelineControls({ locale }: { locale: Locale }) {
  const t = dictionary(locale).pipeline;
  const [job, setJob] = useState<PipelineState | null>(null);
  const [pending, setPending] = useState<PipelineAction | null>(null);
  const [error, setError] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [pollVersion, setPollVersion] = useState(0);
  const submitting = useRef(false);
  const busy = job?.status === "queued" || job?.status === "running";

  const reportError = (status: number) => {
    setNeedsLogin(status === 401);
    setError(
      status === 401
        ? t.login
        : status === 403
          ? t.forbidden
          : status === 409
            ? t.busy
            : t.unavailable,
    );
  };

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      let retry = true;
      try {
        const response = await fetch("/api/admin/local-pipeline/", {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) {
          // Public visitors can see the buttons; only an administrator can operate them.
          if ([401, 403].includes(response.status)) {
            retry = false;
            setJob(null);
          } else reportError(response.status);
          return;
        }
        const payload = await response.json();
        if (!controller.signal.aborted) {
          setJob(payload.data);
          setError((previous) => (previous === t.unavailable ? "" : previous));
        }
      } catch {
        if (!controller.signal.aborted) setError(t.unavailable);
      } finally {
        if (!controller.signal.aborted) {
          setLoaded(true);
          if (retry) timer = setTimeout(poll, 5000);
        }
      }
    };
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [t.unavailable, pollVersion]);

  const submit = async (action: PipelineAction) => {
    if (submitting.current || busy) return;
    submitting.current = true;
    setPending(action);
    setError("");
    setNeedsLogin(false);
    try {
      const response = await fetch("/api/admin/local-pipeline/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) {
        reportError(response.status);
        return;
      }
      const payload = await response.json();
      setJob(payload.data);
      setPollVersion((version) => version + 1);
    } catch {
      setError(t.unavailable);
    } finally {
      submitting.current = false;
      setPending(null);
    }
  };

  const message = job ? (job.status === "idle" ? "" : t[job.status]) : "";
  return (
    <div className="pipeline-controls" aria-busy={pending !== null}>
      <div className="pipeline-buttons">
        <button
          type="button"
          className="button button-small pipeline-sync"
          disabled={!loaded || pending !== null || busy}
          title={t.syncTitle}
          onClick={() => void submit("sync_build")}
        >
          {pending === "sync_build" ? t.sending : t.sync}
        </button>
        <button
          type="button"
          className="button button-small"
          disabled={!loaded || pending !== null || busy}
          title={t.deployTitle}
          onClick={() => void submit("deploy")}
        >
          {pending === "deploy" ? t.sending : t.deploy}
        </button>
      </div>
      {(error || message) && (
        <div className="pipeline-feedback" role="status" aria-live="polite">
          {error || (
            <>
              {job?.action === "sync_build" ? t.sync : t.deploy}: {message}
              {job?.status === "queued" && job.runner?.online === false && (
                <> {t.offline}</>
              )}
              {job?.status === "failed" &&
                job.phase === "local_memory_insufficient" && <> {t.memory}</>}
            </>
          )}
          {needsLogin && (
            <>
              {" "}
              <a href={url(locale, "login")}>{t.signIn}</a>
            </>
          )}
        </div>
      )}
    </div>
  );
}

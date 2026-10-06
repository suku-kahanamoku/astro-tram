import { useEffect, useRef, useState } from "react";
import type { PipelineAction, PipelineState } from "../types";
import { dictionary } from "../providers/translations";
import { url, type Locale } from "../../../config/routes";
import "../styles/pipeline.css";
import { useOnlinePlanners } from "../hooks/useOnlinePlanners";

export default function PipelineControls({ locale }: { locale: Locale }) {
  const t = dictionary(locale).pipeline;
  const [job, setJob] = useState<PipelineState | null>(null);
  const [pending, setPending] = useState<PipelineAction | null>(null);
  const [error, setError] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const submitting = useRef(false);
  const busy = job?.status === "queued" || job?.status === "running";
  const online = useOnlinePlanners();
  const onlineLabel = online.value
    ? online.value.enabled
      ? t.disableOnline
      : t.enableOnline
    : t.online;
  const onlineTitle = online.value
    ? online.value.enabled
      ? t.disableOnlineTitle
      : t.enableOnlineTitle
    : t.onlineTitle;
  const visibleError =
    error ||
    (online.error
      ? online.error === 401
        ? t.login
        : online.error === 403
          ? t.forbidden
          : t.unavailable
      : "");

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
    let active = true;
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch("/api/admin/local-pipeline/", {
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(15000),
          ]),
          cache: "no-store",
        });
        if (!active) return;
        if (!response.ok) {
          // Public visitors see the controls; authentication is required for actions.
          if (![401, 403].includes(response.status))
            reportError(response.status);
          return;
        }
        const payload = await response.json();
        if (active) setJob(payload.data);
      } catch {
        if (active) setError(t.unavailable);
      } finally {
        if (active) setLoaded(true);
      }
    };
    void load();
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  const submit = async (action: PipelineAction) => {
    if (!loaded || submitting.current || busy) return;
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
    } catch {
      setError(t.unavailable);
    } finally {
      submitting.current = false;
      setPending(null);
    }
  };

  const message = job ? (job.status === "idle" ? "" : t[job.status]) : "";
  const failureReason =
    job?.phase === "local_memory_insufficient"
      ? t.memory
      : job?.phase === "runner_disconnected"
        ? t.disconnected
        : job?.phase === "runner_error"
          ? t.runnerError
          : job?.phase === "maven_failed"
            ? t.mavenFailed
            : job?.phase === "local_otp_restore_failed"
              ? t.otpRestoreFailed
              : "";
  return (
    <div
      className="pipeline-controls"
      aria-busy={pending !== null || online.pending}
    >
      <div className="pipeline-buttons">
        <button
          type="button"
          className="button button-small pipeline-online"
          disabled={!online.loaded || online.pending || pending !== null}
          title={onlineTitle}
          aria-label={onlineTitle}
          onClick={() => void online.toggle()}
        >
          {onlineLabel}
        </button>
        <button
          type="button"
          className="button button-small pipeline-sync"
          disabled={!loaded || pending !== null || online.pending || busy}
          title={t.syncTitle}
          onClick={() => void submit("sync_build")}
        >
          {pending === "sync_build" ? t.sending : t.sync}
        </button>
        <button
          type="button"
          className="button button-small"
          disabled={!loaded || pending !== null || online.pending || busy}
          title={t.deployTitle}
          onClick={() => void submit("deploy")}
        >
          {pending === "deploy" ? t.sending : t.deploy}
        </button>
      </div>
      {(visibleError || message) && (
        <div className="pipeline-feedback" role="status" aria-live="polite">
          {visibleError || (
            <>
              {job?.action === "sync_build" ? t.sync : t.deploy}: {message}
              {job?.status === "queued" && job.runner?.online === false && (
                <> {t.offline}</>
              )}
              {job?.status === "failed" && failureReason && (
                <> {failureReason}</>
              )}
            </>
          )}
          {(needsLogin || online.error === 401) && (
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

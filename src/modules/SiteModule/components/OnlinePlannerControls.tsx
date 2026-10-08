import { dictionary } from "../providers/translations";
import { url, type Locale } from "../../../config/routes";
import "../styles/pipeline.css";
import { useOnlinePlanners } from "../hooks/useOnlinePlanners";
export default function OnlinePlannerControls({ locale }: { locale: Locale }) {
  const t = dictionary(locale).pipeline;
  const online = useOnlinePlanners();
  const label = online.value
    ? online.value.enabled
      ? t.disableOnline
      : t.enableOnline
    : t.online;
  const title = online.value
    ? online.value.enabled
      ? t.disableOnlineTitle
      : t.enableOnlineTitle
    : t.onlineTitle;
  return (
    <div className="pipeline-controls" aria-busy={online.pending}>
      <button
        type="button"
        className="button button-small pipeline-online"
        disabled={!online.loaded || online.pending}
        title={title}
        aria-label={title}
        onClick={() => void online.toggle()}
      >
        {label}
      </button>
      {online.error !== 0 && (
        <div className="pipeline-feedback" role="status" aria-live="polite">
          {online.error === 401
            ? t.login
            : online.error === 403
              ? t.forbidden
              : t.unavailable}
          {online.error === 401 && (
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

import { dictionary } from "../providers/translations";
import { url, type Locale } from "../../../config/routes";
import { useAccount } from "../hooks/useAccount";

/** Only the authenticated API response contains personal data, never page HTML. */
export default function AccountProfile({ locale }: { locale: Locale }) {
  const t = dictionary(locale).auth;
  const { user, error, logoutError } = useAccount(url(locale, "login"));
  return (
    <section className="shell auth-section">
      <div className="card auth-card" aria-busy={!user && !error}>
        <p className="eyebrow">{t.account}</p>
        <h1>{user ? `${user.first_name} ${user.last_name}` : t.account}</h1>
        {user ? (
          <p>{user.email}</p>
        ) : (
          <p role="status">{error ? t.accountUnavailable : t.accountLoading}</p>
        )}
        {logoutError && (
          <p className="alert alert-error" role="alert">
            {t.logoutError}
          </p>
        )}
        <form method="post" action="/api/auth/logout/">
          <input type="hidden" name="locale" value={locale} />
          <button className="btn btn-outline" type="submit">
            {t.logout}
          </button>
        </form>
      </div>
    </section>
  );
}

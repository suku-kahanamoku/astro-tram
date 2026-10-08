import { useEffect, useState } from "react";
import { dictionary } from "../providers/translations";
import type { Locale } from "../../LangModule/config";

/** The form still posts without JS; redirect errors are read after hydration. */
export default function LoginForm({ locale }: { locale: Locale }) {
  const t = dictionary(locale);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setError(new URLSearchParams(location.search).get("error"));
  }, []);
  return (
    <section className="shell auth-section">
      <div className="card auth-card">
        <p className="eyebrow">{t.auth.eyebrow}</p>
        <h1>{t.auth.title}</h1>
        <p>{t.auth.description}</p>
        {error && (
          <p className="alert alert-error" role="alert">
            {error === "invalid" ? t.auth.invalid : t.auth.unavailable}
          </p>
        )}
        <form method="post" action="/api/auth/login/" className="auth-form">
          <input type="hidden" name="locale" value={locale} />
          <label>
            {t.auth.email}
            <input
              className="input w-full"
              name="email"
              type="email"
              autoComplete="username"
              required
              maxLength={254}
            />
          </label>
          <label>
            {t.auth.password}
            <input
              className="input w-full"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={1024}
            />
          </label>
          <button className="btn btn-primary" type="submit">
            {t.auth.submit} <span aria-hidden="true">→</span>
          </button>
        </form>
      </div>
    </section>
  );
}

import {
  tripFeatures,
  reservationLabels,
  type ReservationKind,
} from "../config/tripFeatures";
import { Fragment, type ReactNode } from "react";
import Icon from "../../UIModule/components/TransitIcon";
import { safeWebUrl } from "../providers/tripLegend";
import type { Trip, Leg } from "../types";
import type { Dictionary } from "../providers/translations";
export function LinkedNote({ text }: { text: string }) {
  const nodes: ReactNode[] = [];
  let previous = 0;
  for (const match of text.matchAll(/(?:https?:\/\/|www\.)[^\s<>"']+/gu)) {
    const token = match[0].replace(/[.,;!?)]+$/u, ""),
      href = safeWebUrl(token);
    nodes.push(
      text.slice(previous, match.index),
      href ? (
        <a
          key={match.index}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
        >
          {token}
        </a>
      ) : (
        token
      ),
    );
    previous = match.index! + token.length;
  }
  nodes.push(text.slice(previous));
  return <>{nodes}</>;
}
export default function TripLegend({
  trip,
  leg,
  t,
  locale,
  section = "all",
}: {
  trip: Trip;
  leg: Leg;
  t: Dictionary;
  locale: string;
  section?: "all" | "summary" | "notes";
}) {
  const rows: { icon: string; label: string; value: ReactNode }[] = [];
  const m = trip.metadata;
  const operator =
    m?.operator ??
    (leg.operator
      ? { name: leg.operator, city: null, url: null, phone: null }
      : null);
  if (operator && section !== "summary") {
    const url = operator.url ? safeWebUrl(operator.url) : null;
    const phone = operator.phone?.replace(/[\s()-]/g, "");
    const parts: ReactNode[] = [operator.name];
    if (operator.city) parts.push(operator.city);
    if (url)
      parts.push(
        <a href={url} target="_blank" rel="noopener noreferrer">
          {operator.url}
        </a>,
      );
    if (operator.phone)
      parts.push(
        phone && /^[+]?\d{5,20}$/.test(phone) ? (
          <a href={`tel:${phone}`}>{operator.phone}</a>
        ) : (
          operator.phone
        ),
      );
    rows.push({
      icon: "building",
      label: t.operator,
      value: parts.map((p, i) => (
        <Fragment key={i}>
          {i > 0 ? " · " : ""}
          {p}
        </Fragment>
      )),
    });
  }
  if (m?.serviceDate && section !== "notes") {
    const d = new Date(`${m.serviceDate}T12:00:00Z`);
    if (Number.isFinite(d.getTime()))
      rows.push({
        icon: "calendar",
        label: t.tripDate,
        value: new Intl.DateTimeFormat(locale, {
          dateStyle: "long",
          timeZone: "UTC",
        }).format(d),
      });
  }
  if (m?.number && section !== "notes")
    rows.push({
      icon: "ticket",
      label: t.tripNumber,
      value: (
        <>
          <strong>{m.line ? `${m.line}/${m.number}` : m.number}</strong>
          {m.name ? ` · ${m.name}` : ""}
        </>
      ),
    });
  else if (m?.name && section !== "notes")
    rows.push({ icon: "ticket", label: t.tripName, value: m.name });
  if (section !== "summary") {
    if (m?.accessibility)
      rows.push({
        icon: "wheelchair",
        label: t.accessibility,
        value:
          m.accessibility === "partial"
            ? t.partiallyAccessibleVehicle
            : t.accessibleVehicle,
      });
    for (const feature of m?.features ?? []) {
      const config = tripFeatures[feature];
      if (config)
        rows.push({
          icon: config.icon,
          label: t.tripEquipment,
          value: t[config.label],
        });
    }
    for (const kind of Object.keys(reservationLabels) as ReservationKind[]) {
      const policy = m?.reservations?.[kind];
      if (!policy) continue;
      const config = reservationLabels[kind];
      rows.push({
        icon: config.icon,
        label: t[config.label],
        value:
          policy === "mandatory"
            ? t.reservationMandatory
            : t.reservationAvailable,
      });
    }
  }
  const technicalNotes: string[] = [];
  const seen = new Set<string>();
  for (const note of section === "summary" ? [] : (m?.notes ?? [])) {
    const text =
      note.texts[locale] ||
      note.texts[locale.split("-")[0]] ||
      note.texts[note.defaultLanguage ?? ""] ||
      Object.values(note.texts)[0];
    if (!text || seen.has(text)) continue;
    seen.add(text);
    if (note.category === "technical") {
      technicalNotes.push(text);
      continue;
    }
    rows.push({
      icon: "info",
      label: note.scope === "line" ? t.lineNote : t.tripNote,
      value: <LinkedNote text={text} />,
    });
  }
  return rows.length || technicalNotes.length ? (
    <>
      {rows.length > 0 && (
        <ul className="trip-legend">
          {rows.map((r, i) => (
            <li key={i}>
              <Icon name={r.icon} />
              <div>
                <span className="trip-info-label">{r.label}</span>
                {r.value}
              </div>
            </li>
          ))}
        </ul>
      )}
      {technicalNotes.length > 0 && (
        <details className="trip-technical-notes">
          <summary>{t.technicalTimetableDetails}</summary>
          <p>{t.technicalTimetableHint}</p>
          <ul>
            {technicalNotes.map((text, i) => (
              <li key={i}>
                <LinkedNote text={text} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  ) : null;
}

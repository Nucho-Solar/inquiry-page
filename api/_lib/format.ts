import type { Lead } from "./lead.js";

const nairobiFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Nairobi",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function nairobiDateTime(iso: string): string {
  const parts = Object.fromEntries(
    nairobiFormat.formatToParts(new Date(iso)).map((part) => [part.type, part.value]),
  );
  return `${parts.day} ${parts.month} ${parts.hour}:${parts.minute} EAT`;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

const flat = (s: string) => s.replace(/[\r\n\u2028\u2029]+/g, " ");

// Campaign values come from the visitor's URL: keep them on one line and short.
const tag = (s: string) => truncate(flat(s), 40);

function source(lead: Lead): string {
  const { gclid, utm_source, utm_medium, utm_campaign } = lead.attribution;
  const origin = gclid
    ? "Google Ads"
    : utm_source
      ? [tag(utm_source), ...(utm_medium ? [tag(utm_medium)] : [])].join(" / ")
      : "Direct";
  return [origin, ...(utm_campaign ? [tag(utm_campaign)] : []), nairobiDateTime(lead.receivedAt)].join(" · ");
}

export function formatTelegram(lead: Lead): {
  text: string;
  replyMarkup: { inline_keyboard: { text: string; url: string }[][] };
} {
  const lines = [
    `🔆 New solar lead · ${escapeHtml(capitalize(lead.useCase))}`,
    `👤 ${escapeHtml(lead.name)}`,
    `📞 ${escapeHtml(lead.phone)}`,
    `📍 ${escapeHtml(lead.location)}`,
    `💰 ${escapeHtml(lead.budget)}`,
    `🛠 ${lead.services.map(escapeHtml).join(", ")}`,
    ...(lead.explanation ? [`📝 ${escapeHtml(lead.explanation)}`] : []),
    escapeHtml(source(lead)),
  ];

  return {
    text: lines.join("\n"),
    replyMarkup: {
      inline_keyboard: [
        [
          { text: "WhatsApp", url: `https://wa.me/${lead.phone.replace(/^\+/, "")}` },
          {
            text: "Maps",
            url:
              "https://www.google.com/maps/search/?api=1&query=" +
              encodeURIComponent(`${lead.location}, Kenya`),
          },
        ],
      ],
    },
  };
}

export function formatEmail(lead: Lead): { subject: string; html: string; text: string } {
  const useCase = capitalize(lead.useCase);
  const subject = `New lead: ${truncate(flat(lead.name), 60)}, ${truncate(flat(lead.location), 40)} (${useCase}, ${lead.budget})`;

  const rows: [string, string][] = [
    ["Name", lead.name],
    ["Phone", lead.phone],
    ["Location", lead.location],
    ["Use case", useCase],
    ["Budget", lead.budget],
    ["Services", lead.services.join(", ")],
    ["Notes", lead.explanation],
    ["Source", source(lead)],
    ["GCLID", lead.attribution.gclid ?? ""],
    ["Lead ID", lead.id],
  ];
  const present = rows.filter(([, value]) => value !== "");

  const text = present.map(([label, value]) => `${label}: ${value}`).join("\n");
  const html =
    `<table cellpadding="6" style="font-family:sans-serif;font-size:14px">` +
    present
      .map(
        ([label, value]) =>
          `<tr><td><strong>${label}</strong></td><td style="white-space:pre-wrap">${escapeHtml(value)}</td></tr>`,
      )
      .join("") +
    `</table>`;

  return { subject, html, text };
}

/** Formatting helpers shared by every screen. Money is always integer cents. */

const CURRENCY = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const DAY = 24 * 60 * 60 * 1000;

export function formatCents(cents) {
  const value = Number(cents);
  if (!Number.isFinite(value)) return CURRENCY.format(0);
  return CURRENCY.format(value / 100);
}

/** Parse API dates. Naive timestamps from SQLite are UTC, so tag them as such. */
export function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [year, month, day] = text.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/.test(text);
  const parsed = new Date(hasZone ? text : `${text}Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const DATE_PARTS = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const TIME_PARTS = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

function readPart(parts, type) {
  const found = parts.find((part) => part.type === type);
  return found ? found.value : "";
}

export function formatDate(value) {
  const date = parseDate(value);
  if (!date) return "\u2014";
  const parts = DATE_PARTS.formatToParts(date);
  return `${readPart(parts, "day")} ${readPart(parts, "month")} ${readPart(parts, "year")}`;
}

export function formatDateTime(value) {
  const date = parseDate(value);
  if (!date) return "\u2014";
  const parts = DATE_PARTS.formatToParts(date);
  const time = TIME_PARTS.formatToParts(date);
  return `${readPart(parts, "day")} ${readPart(parts, "month")} ${readPart(parts, "year")}, ${readPart(time, "hour")}:${readPart(time, "minute")}`;
}

/** Humanised "x days ago" that never produces "-1 days ago". */
export function relativeTime(value, now = Date.now()) {
  const date = parseDate(value);
  if (!date) return "—";
  const diff = now - date.getTime();
  if (diff < 0) return "just now";
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(diff / DAY);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} ${months === 1 ? "month" : "months"} ago`;
  const years = Math.floor(months / 12);
  return `${years} ${years === 1 ? "year" : "years"} ago`;
}

export function todayIso(now = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function initials(fullName) {
  const parts = String(fullName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export const STATUS_LABELS = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
  reimbursed: "Reimbursed",
};

export function statusLabel(status) {
  return STATUS_LABELS[status] || String(status || "").replace(/^\w/, (c) => c.toUpperCase());
}

export function pluralize(count, singular, plural) {
  return count === 1 ? singular : plural || `${singular}s`;
}

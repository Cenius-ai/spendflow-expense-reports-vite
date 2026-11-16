import { formatCents } from "../lib/format.js";

/**
 * Horizontal bar chart drawn with plain divs — no chart library, no SVG maths,
 * so it renders identically offline. Bars are sorted highest to lowest by the
 * caller and every bar carries its dollar value as text.
 */
export default function BarChart({ buckets, label, tone = "accent", emptyLabel }) {
  const items = Array.isArray(buckets) ? buckets : [];
  const max = items.reduce((highest, bucket) => Math.max(highest, bucket.total_cents), 0);

  if (items.length === 0) {
    return <p className="empty__body">{emptyLabel || "No data yet."}</p>;
  }

  return (
    <div className="chart" role="group" aria-label={label}>
      {items.map((bucket) => {
        const share = max > 0 ? Math.max(2, Math.round((bucket.total_cents / max) * 100)) : 2;
        return (
          <div className="chart__row" key={bucket.key}>
            <span className="chart__label" title={bucket.label}>
              {bucket.label}
            </span>
            <span className="chart__track">
              <span
                className={tone === "alt" ? "chart__bar chart__bar--alt" : "chart__bar"}
                style={{ width: `${share}%` }}
              />
            </span>
            <span className="chart__value">{formatCents(bucket.total_cents)}</span>
          </div>
        );
      })}
    </div>
  );
}

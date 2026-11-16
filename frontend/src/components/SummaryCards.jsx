import Flag from "./Flag.jsx";
import Money from "./Money.jsx";
import { pluralize } from "../lib/format.js";

export default function SummaryCards({ summary }) {
  const cards = [
    {
      label: "Pending approval",
      value: summary.submitted.count,
      sub: (
        <>
          <Money cents={summary.submitted.total_cents} /> waiting on a manager
        </>
      ),
      flag: summary.submitted.count > 0 ? "Needs review" : null,
    },
    {
      label: "Awaiting reimbursement",
      value: <Money cents={summary.approved.total_cents} />,
      sub: `${summary.approved.count} approved ${pluralize(summary.approved.count, "report")}`,
    },
    {
      label: "Reimbursed",
      value: <Money cents={summary.reimbursed.total_cents} />,
      sub: `${summary.reimbursed.count} paid ${pluralize(summary.reimbursed.count, "report")}`,
    },
    {
      label: "Drafts",
      value: summary.draft.count,
      sub: (
        <>
          <Money cents={summary.draft.total_cents} /> not submitted yet
        </>
      ),
    },
  ];

  return (
    <div className="metric-grid">
      {cards.map((card) => (
        <div className="metric" key={card.label}>
          <span className="metric__label">{card.label}</span>
          <span className="metric__value">{card.value}</span>
          <span className="metric__sub">{card.sub}</span>
          {card.flag ? <Flag tone="accent">{card.flag}</Flag> : null}
        </div>
      ))}
    </div>
  );
}

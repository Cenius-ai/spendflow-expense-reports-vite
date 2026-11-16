import { useState } from "react";

import Money from "./Money.jsx";
import StatusBadge from "./StatusBadge.jsx";
import { formatDate, relativeTime } from "../lib/format.js";

/** One report in the manager queue with its inline decision actions. */
export default function ApprovalCard({ report, onApprove, onReject, onReimburse, busy }) {
  const [error, setError] = useState("");

  async function run(action) {
    setError("");
    try {
      await action();
    } catch (actionError) {
      setError(actionError.message || "That action could not be completed.");
    }
  }

  const isSubmitted = report.status === "submitted";
  const isApproved = report.status === "approved";

  return (
    <article className="approval-card">
      <div className="approval-card__head">
        <span className="approval-card__title">{report.title}</span>
        <StatusBadge status={report.status} />
      </div>
      <div className="approval-card__meta">
        <span>{report.owner_name}</span>
        <span>
          {report.expense_count} {report.expense_count === 1 ? "line" : "lines"}
        </span>
        <span>
          {isSubmitted ? "Submitted" : "Approved"} {relativeTime(report.submitted_at || report.decided_at)}
        </span>
      </div>
      <div className="approval-card__total">
        <Money cents={report.total_cents} />
      </div>
      <div className="approval-card__actions">
        {isSubmitted ? (
          <>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={() => run(onApprove)}
              disabled={busy}
            >
              {busy ? <span className="spinner" aria-hidden="true" /> : "Approve"}
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={onReject}
              disabled={busy}
            >
              Reject with note
            </button>
          </>
        ) : null}
        {isApproved ? (
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={() => run(onReimburse)}
            disabled={busy}
          >
            {busy ? <span className="spinner" aria-hidden="true" /> : "Mark reimbursed"}
          </button>
        ) : null}
        <span className="panel__meta">
          {report.decided_at ? `Decided ${formatDate(report.decided_at)}` : ""}
        </span>
      </div>
      {error ? (
        <p className="field__error" role="alert">
          {error}
        </p>
      ) : null}
    </article>
  );
}

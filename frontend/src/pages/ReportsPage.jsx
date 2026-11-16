import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { api } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";
import EmptyState from "../components/EmptyState.jsx";
import ErrorBanner from "../components/ErrorBanner.jsx";
import Flag from "../components/Flag.jsx";
import Money from "../components/Money.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { SkeletonRows } from "../components/Skeleton.jsx";
import { relativeTime, statusLabel } from "../lib/format.js";
import { validateReportTitle } from "../lib/validation.js";
import useDocumentTitle from "../lib/useDocumentTitle.js";

const FILTERS = [
  { value: "all", label: "All reports" },
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "reimbursed", label: "Reimbursed" },
];

export default function ReportsPage() {
  useDocumentTitle("Reports");
  const { isManager } = useAuth();
  const navigate = useNavigate();
  const titleRef = useRef(null);

  const [status, setStatus] = useState("loading");
  const [reports, setReports] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [filter, setFilter] = useState("all");

  const [title, setTitle] = useState("");
  const [titleError, setTitleError] = useState("");
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setStatus("loading");
    setLoadError("");
    try {
      const rows = await api.listReports();
      setReports(rows);
      setStatus("ready");
    } catch (error) {
      setLoadError(error.message);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const totals = { all: reports.length };
    for (const report of reports) {
      totals[report.status] = (totals[report.status] || 0) + 1;
    }
    return totals;
  }, [reports]);

  const visible = filter === "all" ? reports : reports.filter((report) => report.status === filter);

  async function handleCreate(event) {
    event.preventDefault();
    if (creating) return;
    const problem = validateReportTitle(title);
    if (problem) {
      setTitleError(problem);
      titleRef.current?.focus();
      return;
    }
    setCreating(true);
    setTitleError("");
    setCreateError("");
    try {
      const report = await api.createReport(title.trim());
      navigate(`/reports/${report.id}`);
    } catch (error) {
      setCreateError(error.message);
    } finally {
      setCreating(false);
    }
  }

  const isEmptyWorkspace = status === "ready" && reports.length === 0;

  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">{isManager ? "Whole team" : "Your reports"}</span>
          <h1>Reports</h1>
          <p className="page-head__sub">
            {isManager
              ? "Every expense report in the workspace with its current status."
              : "Each report collects expense lines and goes to a manager for approval."}
          </p>
        </div>
        <Flag tone="accent">{counts.all} {counts.all === 1 ? "report" : "reports"}</Flag>
      </div>

      <div className="master-detail">
        <aside className="rail" aria-label="Report filters">
          <div className="rail__group">
            <span className="rail__title">Status</span>
            {FILTERS.map((option) => (
              <button
                key={option.value}
                type="button"
                className="filter"
                aria-pressed={filter === option.value}
                onClick={() => setFilter(option.value)}
              >
                <span>{option.label}</span>
                <span className="filter__count">{counts[option.value] || 0}</span>
              </button>
            ))}
          </div>

          {filter !== "all" ? (
            <div className="chip-row">
              <button type="button" className="chip" onClick={() => setFilter("all")}>
                Clear filter ({statusLabel(filter)})
              </button>
            </div>
          ) : null}

          <div className="rail__group">
            <span className="rail__title">Scope</span>
            <p className="panel__meta">
              {isManager
                ? "Managers see every employee's reports. Approve or reject them under Approvals."
                : "You see your own reports. A manager reviews anything you submit."}
            </p>
          </div>
        </aside>

        <div className="results">
          <form className="new-report" onSubmit={handleCreate} noValidate>
            <div className="field">
              <label className="field__label" htmlFor="new-report-title">
                New report
              </label>
              <input
                id="new-report-title"
                ref={titleRef}
                className="input"
                type="text"
                name="title"
                placeholder="Client visit — March"
                value={title}
                autoFocus={isEmptyWorkspace}
                onChange={(event) => {
                  setTitle(event.target.value);
                  if (titleError) setTitleError("");
                }}
                aria-invalid={titleError ? "true" : undefined}
                aria-describedby={titleError ? "new-report-error" : undefined}
              />
              {titleError ? (
                <span className="field__error" id="new-report-error">
                  {titleError}
                </span>
              ) : null}
            </div>
            <button type="submit" className="btn btn--primary" disabled={creating}>
              {creating ? <span className="spinner" aria-hidden="true" /> : "Create report"}
            </button>
          </form>

          {createError ? <ErrorBanner message={createError} /> : null}

          <div className="results__head">
            <h2 className="section-title">
              {filter === "all" ? "All reports" : `${statusLabel(filter)} reports`}
            </h2>
            <span className="results__count">
              {visible.length} of {reports.length} shown
            </span>
          </div>

          {loadError ? <ErrorBanner message={loadError} onRetry={load} /> : null}

          {status === "loading" ? (
            <div className="panel">
              <div className="panel__body">
                <SkeletonRows rows={6} />
              </div>
            </div>
          ) : null}

          {status === "ready" && isEmptyWorkspace ? (
            <EmptyState
              title="No reports yet"
              body="Name your first report above, then add the expense lines from your receipts. Nothing is submitted until you say so."
            />
          ) : null}

          {status === "ready" && !isEmptyWorkspace && visible.length === 0 ? (
            <EmptyState
              title={`No ${statusLabel(filter).toLowerCase()} reports`}
              body="Nothing in this status right now."
              action={
                <button type="button" className="btn btn--secondary btn--sm" onClick={() => setFilter("all")}>
                  Clear filter
                </button>
              }
            />
          ) : null}

          {visible.length > 0 ? (
            <div className="panel">
              <div className="table-scroll">
                <table className="table">
                  <caption>
                    {visible.length} {visible.length === 1 ? "report" : "reports"}, newest first
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Report</th>
                      <th scope="col">Owner</th>
                      <th scope="col" className="num">
                        Total
                      </th>
                      <th scope="col">Status</th>
                      <th scope="col">Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((report) => (
                      <tr key={report.id}>
                        <td data-label="Report">
                          <Link className="table__title" to={`/reports/${report.id}`}>
                            {report.title}
                          </Link>
                          <span className="table__sub">
                            {report.expense_count} {report.expense_count === 1 ? "line" : "lines"}
                          </span>
                        </td>
                        <td data-label="Owner">{report.owner_name}</td>
                        <td data-label="Total" className="num">
                          <Money cents={report.total_cents} />
                        </td>
                        <td data-label="Status">
                          <StatusBadge status={report.status} />
                        </td>
                        <td data-label="Updated">{relativeTime(report.updated_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}

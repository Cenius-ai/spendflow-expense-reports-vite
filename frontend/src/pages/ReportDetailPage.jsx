import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { api } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import DecisionDialog from "../components/DecisionDialog.jsx";
import ErrorBanner from "../components/ErrorBanner.jsx";
import ExpenseForm from "../components/ExpenseForm.jsx";
import ExpenseTable from "../components/ExpenseTable.jsx";
import Flag from "../components/Flag.jsx";
import Money from "../components/Money.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { Drawer } from "../components/Overlays.jsx";
import { SkeletonRows } from "../components/Skeleton.jsx";
import { formatDate, formatDateTime } from "../lib/format.js";
import useDocumentTitle from "../lib/useDocumentTitle.js";

export default function ReportDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isManager } = useAuth();

  const [report, setReport] = useState(null);
  const [status, setStatus] = useState("loading");
  const [loadError, setLoadError] = useState("");
  const [unavailable, setUnavailable] = useState(false);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState(null);
  const [drawer, setDrawer] = useState(null);
  const [expenseBusyId, setExpenseBusyId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [dialogError, setDialogError] = useState("");

  useDocumentTitle(report ? report.title : "Report");

  const load = useCallback(async () => {
    setStatus("loading");
    setLoadError("");
    setUnavailable(false);
    try {
      const data = await api.getReport(id);
      setReport(data);
      setStatus("ready");
    } catch (error) {
      if (error.status === 403 || error.status === 404) {
        setUnavailable(true);
        setStatus("ready");
        return;
      }
      setLoadError(error.message);
      setStatus("error");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function runAction(key, action, successText) {
    if (busy) return;
    setBusy(key);
    setMessage(null);
    try {
      const updated = await action();
      if (updated) setReport(updated);
      setMessage({ tone: "success", text: successText });
    } catch (error) {
      setMessage({ tone: "error", text: error.message });
      throw error;
    } finally {
      setBusy("");
    }
  }

  async function handleExpenseSubmit(payload) {
    if (!report) return;
    setBusy("expense");
    setMessage(null);
    try {
      if (drawer && drawer.mode === "edit") {
        await api.updateExpense(drawer.expense.id, payload);
        const refreshed = await api.getReport(report.id);
        setReport(refreshed);
        setMessage({ tone: "success", text: "Expense line updated." });
      } else {
        const updated = await api.addExpense(report.id, payload);
        setReport(updated);
        setMessage({ tone: "success", text: "Expense line added." });
      }
      setDrawer(null);
    } catch (error) {
      // Keep the drawer open with the server's message; never reject the promise
      // the form handed us (that would surface as an unhandled rejection).
      setDialogError(error.message);
    } finally {
      setBusy("");
    }
  }

  async function handleExpenseDelete(expense) {
    if (!report || expenseBusyId) return;
    setExpenseBusyId(expense.id);
    setMessage(null);
    try {
      await api.deleteExpense(expense.id);
      const refreshed = await api.getReport(report.id);
      setReport(refreshed);
      setMessage({ tone: "success", text: `Removed ${expense.merchant}.` });
    } catch (error) {
      setMessage({ tone: "error", text: error.message });
    } finally {
      setExpenseBusyId(null);
    }
  }

  async function handleReject(note) {
    setDialogError("");
    try {
      await runAction("reject", () => api.decideReport(id, "rejected", note), "Report rejected.");
      setRejecting(false);
    } catch (error) {
      setDialogError(error.message);
    }
  }

  async function handleDeleteReport() {
    setBusy("delete");
    try {
      await api.deleteReport(id);
      navigate("/reports", { replace: true });
    } catch (error) {
      setMessage({ tone: "error", text: error.message });
      setBusy("");
      setConfirmDelete(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="panel">
        <div className="panel__body">
          <SkeletonRows rows={5} />
        </div>
      </div>
    );
  }

  if (unavailable) {
    return (
      <div className="empty">
        <p className="empty__title">Report not found or not available to you</p>
        <p className="empty__body">
          This report may belong to another employee, or it may have been deleted.
        </p>
        <Link className="btn btn--secondary btn--sm" to="/reports">
          Back to reports
        </Link>
      </div>
    );
  }

  if (status === "error") {
    return <ErrorBanner message={loadError} onRetry={load} />;
  }

  if (!report) return null;

  const isOwner = user && report.owner_id === user.id;
  const canEditLines = isOwner && report.status === "draft";
  const canSubmit = isOwner && report.status === "draft";
  const canDecide = isManager && report.status === "submitted" && !isOwner;
  const canReimburse = isManager && report.status === "approved";
  const canDelete = isOwner && report.status === "draft";

  return (
    <>
      <p style={{ marginBottom: "var(--space-3)" }}>
        <Link to="/reports">← Back to reports</Link>
      </p>

      <header className="detail-head">
        <div className="detail-head__top">
          <StatusBadge status={report.status} />
          <span className="eyebrow">{report.owner_name}</span>
          <Flag>
            Report #{report.id} · {report.expense_count}{" "}
            {report.expense_count === 1 ? "line" : "lines"}
          </Flag>
        </div>
        <h1>{report.title}</h1>

        <div className="total-flag">
          <span className="total-flag__value">
            <Money cents={report.total_cents} />
          </span>
          <Flag tone="accent">
            {report.status === "draft" ? "Running total" : "Submitted total"}
          </Flag>
        </div>

        <div className="detail-head__actions">
          {canEditLines ? (
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                setDialogError("");
                setDrawer({ mode: "create" });
              }}
            >
              Add expense
            </button>
          ) : null}
          {canSubmit ? (
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() =>
                runAction("submit", () => api.submitReport(id), "Report submitted for approval.").catch(
                  () => {},
                )
              }
              disabled={busy === "submit"}
            >
              {busy === "submit" ? <span className="spinner" aria-hidden="true" /> : "Submit for approval"}
            </button>
          ) : null}
          {canDelete ? (
            <button type="button" className="btn btn--ghost" onClick={() => setConfirmDelete(true)}>
              Delete draft
            </button>
          ) : null}
          {canDecide ? (
            <>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() =>
                  runAction("approve", () => api.decideReport(id, "approved", null), "Report approved.").catch(
                    () => {},
                  )
                }
                disabled={busy === "approve"}
              >
                {busy === "approve" ? <span className="spinner" aria-hidden="true" /> : "Approve"}
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => {
                  setDialogError("");
                  setRejecting(true);
                }}
                disabled={busy === "reject"}
              >
                Reject with note
              </button>
            </>
          ) : null}
          {canReimburse ? (
            <button
              type="button"
              className="btn btn--primary"
              onClick={() =>
                runAction("reimburse", () => api.reimburseReport(id), "Marked reimbursed.").catch(() => {})
              }
              disabled={busy === "reimburse"}
            >
              {busy === "reimburse" ? (
                <span className="spinner" aria-hidden="true" />
              ) : (
                "Mark reimbursed"
              )}
            </button>
          ) : null}
        </div>

        <div className="meta-grid">
          <div className="meta">
            <span className="meta__label">Owner</span>
            <span className="meta__value">{report.owner_name}</span>
          </div>
          <div className="meta">
            <span className="meta__label">Created</span>
            <span className="meta__value">{formatDate(report.created_at)}</span>
          </div>
          <div className="meta">
            <span className="meta__label">Submitted</span>
            <span className="meta__value">
              {report.submitted_at ? formatDateTime(report.submitted_at) : "Not submitted"}
            </span>
          </div>
          <div className="meta">
            <span className="meta__label">Reviewer</span>
            <span className="meta__value">{report.reviewer_name || "—"}</span>
          </div>
          <div className="meta">
            <span className="meta__label">Decided</span>
            <span className="meta__value">
              {report.decided_at ? formatDateTime(report.decided_at) : "—"}
            </span>
          </div>
          <div className="meta">
            <span className="meta__label">Reimbursed</span>
            <span className="meta__value">
              {report.reimbursed_at ? formatDateTime(report.reimbursed_at) : "—"}
            </span>
          </div>
        </div>
      </header>

      {message ? (
        <div className={`banner banner--${message.tone}`} role={message.tone === "error" ? "alert" : "status"}>
          <span>{message.text}</span>
        </div>
      ) : null}

      {report.decision_note ? (
        <div
          className={
            report.status === "rejected"
              ? "decision-note decision-note--rejected"
              : "decision-note"
          }
          style={{ marginBottom: "var(--space-5)" }}
        >
          <span className="meta__label">
            {report.status === "rejected" ? "Rejection note" : "Reviewer note"}
          </span>
          <span>{report.decision_note}</span>
          {report.reviewer_name ? (
            <span className="panel__meta">— {report.reviewer_name}</span>
          ) : null}
        </div>
      ) : null}

      <section className="panel" aria-labelledby="expense-lines">
        <div className="panel__head">
          <h2 className="panel__title" id="expense-lines">
            Expense lines
          </h2>
          <span className="panel__meta">
            {canEditLines
              ? "Draft reports can still be edited."
              : `Locked: ${report.status === "draft" ? "not your draft" : "submitted reports cannot change"}`}
          </span>
        </div>
        <div className="panel__body panel__body--flush">
          <ExpenseTable
            expenses={report.expenses}
            canEdit={canEditLines}
            onEdit={(expense) => {
              setDialogError("");
              setDrawer({ mode: "edit", expense });
            }}
            onDelete={handleExpenseDelete}
            busyId={expenseBusyId}
          />
        </div>
      </section>

      {drawer ? (
        <Drawer
          title={drawer.mode === "edit" ? "Edit expense" : "Add expense"}
          onClose={() => setDrawer(null)}
          footer={
            <>
              <button type="button" className="btn btn--ghost" onClick={() => setDrawer(null)} disabled={busy === "expense"}>
                Cancel
              </button>
              <button
                type="submit"
                form="expense-form"
                className="btn btn--primary"
                disabled={busy === "expense"}
              >
                {busy === "expense" ? (
                  <span className="spinner" aria-hidden="true" />
                ) : drawer.mode === "edit" ? (
                  "Save changes"
                ) : (
                  "Add expense"
                )}
              </button>
            </>
          }
        >
          {dialogError ? <ErrorBanner message={dialogError} /> : null}
          <ExpenseForm
            initial={drawer.mode === "edit" ? drawer.expense : null}
            onSubmit={handleExpenseSubmit}
            busy={busy === "expense"}
          />
        </Drawer>
      ) : null}

      {rejecting ? (
        <DecisionDialog
          report={report}
          onCancel={() => setRejecting(false)}
          onConfirm={handleReject}
          busy={busy === "reject"}
          error={dialogError}
        />
      ) : null}

      {confirmDelete ? (
        <ConfirmDialog
          title="Delete this draft?"
          body={`“${report.title}” and its ${report.expense_count} expense ${
            report.expense_count === 1 ? "line" : "lines"
          } will be removed. This cannot be undone.`}
          confirmLabel="Delete draft"
          tone="danger"
          onConfirm={handleDeleteReport}
          onCancel={() => setConfirmDelete(false)}
          busy={busy === "delete"}
        />
      ) : null}
    </>
  );
}

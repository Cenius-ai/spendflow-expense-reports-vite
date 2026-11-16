import { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

import { api } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";
import ApprovalCard from "../components/ApprovalCard.jsx";
import DecisionDialog from "../components/DecisionDialog.jsx";
import EmptyState from "../components/EmptyState.jsx";
import ErrorBanner from "../components/ErrorBanner.jsx";
import Flag from "../components/Flag.jsx";
import Money from "../components/Money.jsx";
import { SkeletonRows } from "../components/Skeleton.jsx";
import useDocumentTitle from "../lib/useDocumentTitle.js";

export default function ApprovalsPage() {
  useDocumentTitle("Approvals");
  const { user, isManager } = useAuth();

  const [status, setStatus] = useState("loading");
  const [reports, setReports] = useState([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [dialogError, setDialogError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setStatus("loading");
    setError("");
    try {
      const rows = await api.listReports();
      setReports(rows);
      setStatus("ready");
    } catch (loadError) {
      setError(loadError.message);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    if (isManager) load();
  }, [isManager, load]);

  if (!isManager) {
    return <Navigate to="/reports" replace />;
  }

  const queue = reports.filter(
    (report) => report.status === "submitted" && report.owner_id !== user?.id,
  );
  const awaitingReimbursement = reports.filter((report) => report.status === "approved");

  async function decide(report, decision, note) {
    if (busyId) return;
    setBusyId(report.id);
    setNotice("");
    try {
      await api.decideReport(report.id, decision, note);
      setNotice(
        decision === "approved"
          ? `Approved “${report.title}”.`
          : `Rejected “${report.title}” with a note.`,
      );
      setRejecting(null);
      await load();
    } catch (actionError) {
      if (decision === "rejected") setDialogError(actionError.message);
      else setNotice(`Could not approve: ${actionError.message}`);
      throw actionError;
    } finally {
      setBusyId(null);
    }
  }

  async function reimburse(report) {
    if (busyId) return;
    setBusyId(report.id);
    setNotice("");
    try {
      await api.reimburseReport(report.id);
      setNotice(`Marked “${report.title}” reimbursed.`);
      await load();
    } catch (actionError) {
      setNotice(`Could not mark reimbursed: ${actionError.message}`);
      throw actionError;
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">Manager view</span>
          <h1>Approvals</h1>
          <p className="page-head__sub">
            Approve or reject submitted reports with a written note, then track what still needs to
            be paid out.
          </p>
        </div>
        <Flag tone="accent">
          {queue.length} waiting · {awaitingReimbursement.length} to pay
        </Flag>
      </div>

      {notice ? (
        <div className="banner banner--success" role="status" style={{ marginBottom: "var(--space-4)" }}>
          <span>{notice}</span>
        </div>
      ) : null}

      {error ? <ErrorBanner message={error} onRetry={load} /> : null}

      {status === "loading" ? (
        <div className="panel">
          <div className="panel__body">
            <SkeletonRows rows={3} />
          </div>
        </div>
      ) : null}

      {status === "ready" ? (
        <>
          <div className="results__head" style={{ marginBottom: "var(--space-3)" }}>
            <h2 className="section-title">Awaiting your decision</h2>
            <span className="results__count">
              {queue.length} {queue.length === 1 ? "report" : "reports"} ·{" "}
              <Money cents={queue.reduce((sum, report) => sum + report.total_cents, 0)} />
            </span>
          </div>

          {queue.length === 0 ? (
            <EmptyState
              title="Nothing waiting on you"
              body="Submitted reports from other employees appear here. Check the reimbursement list below in the meantime."
            />
          ) : (
            <div className="queue__grid" style={{ marginBottom: "var(--space-8)" }}>
              {queue.map((report) => (
                <ApprovalCard
                  key={report.id}
                  report={report}
                  busy={busyId === report.id}
                  onApprove={() => decide(report, "approved", null)}
                  onReject={() => {
                    setDialogError("");
                    setRejecting(report);
                  }}
                  onReimburse={() => reimburse(report)}
                />
              ))}
            </div>
          )}

          <div className="results__head" style={{ marginBottom: "var(--space-3)" }}>
            <h2 className="section-title">Approved, awaiting reimbursement</h2>
            <span className="results__count">
              {awaitingReimbursement.length}{" "}
              {awaitingReimbursement.length === 1 ? "report" : "reports"} ·{" "}
              <Money
                cents={awaitingReimbursement.reduce((sum, report) => sum + report.total_cents, 0)}
              />
            </span>
          </div>

          {awaitingReimbursement.length === 0 ? (
            <EmptyState
              title="Nothing to reimburse"
              body="Approved reports stay here until they are marked reimbursed."
            />
          ) : (
            <div className="queue__grid">
              {awaitingReimbursement.map((report) => (
                <ApprovalCard
                  key={report.id}
                  report={report}
                  busy={busyId === report.id}
                  onApprove={() => decide(report, "approved", null)}
                  onReject={() => {}}
                  onReimburse={() => reimburse(report)}
                />
              ))}
            </div>
          )}
        </>
      ) : null}

      {rejecting ? (
        <DecisionDialog
          report={rejecting}
          error={dialogError}
          busy={busyId === rejecting.id}
          onCancel={() => setRejecting(null)}
          onConfirm={(note) => decide(rejecting, "rejected", note).catch(() => {})}
        />
      ) : null}
    </>
  );
}

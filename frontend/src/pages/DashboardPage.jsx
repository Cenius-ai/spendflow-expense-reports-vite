import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";
import BarChart from "../components/BarChart.jsx";
import EmptyState from "../components/EmptyState.jsx";
import ErrorBanner from "../components/ErrorBanner.jsx";
import Flag from "../components/Flag.jsx";
import Money from "../components/Money.jsx";
import RecentReports from "../components/RecentReports.jsx";
import SummaryCards from "../components/SummaryCards.jsx";
import { SkeletonCharts, SkeletonMetrics, SkeletonRows } from "../components/Skeleton.jsx";
import { formatDate } from "../lib/format.js";
import useDocumentTitle from "../lib/useDocumentTitle.js";

export default function DashboardPage() {
  useDocumentTitle("Dashboard");
  const { user, isManager } = useAuth();
  const [state, setState] = useState({ status: "loading", summary: null, analytics: null, error: null });

  const load = useCallback(async () => {
    setState((previous) => ({ ...previous, status: "loading", error: null }));
    try {
      const [summary, analytics] = await Promise.all([api.dashboardSummary(), api.spendAnalytics()]);
      setState({ status: "ready", summary, analytics, error: null });
    } catch (error) {
      setState((previous) => ({ ...previous, status: "error", error: error.message }));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const { status, summary, analytics, error } = state;
  const scopeLabel = isManager ? "Team spend" : "My spend";

  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">{isManager ? "Manager view" : "Employee view"}</span>
          <h1>{scopeLabel}</h1>
          <p className="page-head__sub">
            {isManager
              ? "Every report in the workspace, with what is waiting on a decision and what is owed."
              : "Your reports, what is waiting on approval and what has been paid back."}
            {summary ? ` Updated ${formatDate(new Date())}.` : ""}
          </p>
        </div>
        <Flag tone="accent">{isManager ? "All employees" : user?.full_name}</Flag>
      </div>

      {error ? <ErrorBanner message={error} onRetry={load} /> : null}

      {status === "loading" && !summary ? (
        <>
          <SkeletonMetrics />
          <SkeletonCharts />
          <div className="panel">
            <div className="panel__head">
              <h2 className="panel__title">Recent activity</h2>
            </div>
            <div className="panel__body">
              <SkeletonRows rows={5} />
            </div>
          </div>
        </>
      ) : null}

      {summary ? (
        <>
          <SummaryCards summary={summary} />

          <div className="chart-grid-2">
            <section className="panel" aria-labelledby="chart-category">
              <div className="panel__head">
                <h2 className="panel__title" id="chart-category">
                  Spend by category
                </h2>
                <span className="panel__meta">
                  <Flag>Approved + reimbursed</Flag>
                </span>
              </div>
              <div className="panel__body">
                {analytics && analytics.by_category.length > 0 ? (
                  <>
                    <BarChart buckets={analytics.by_category} label="Spend by category" />
                    <div className="chart__foot" style={{ marginTop: "var(--space-4)" }}>
                      <span>Highest first</span>
                      <span>
                        Total approved spend <Money cents={analytics.total_cents} />
                      </span>
                    </div>
                  </>
                ) : (
                  <EmptyState
                    title="No approved spend yet"
                    body="Submit your first report — categories appear here once a manager approves it."
                    action={
                      <Link className="btn btn--primary btn--sm" to="/reports">
                        Go to reports
                      </Link>
                    }
                  />
                )}
              </div>
            </section>

            <section className="panel" aria-labelledby="chart-employee">
              <div className="panel__head">
                <h2 className="panel__title" id="chart-employee">
                  Spend by employee
                </h2>
                <span className="panel__meta">
                  <Flag>{isManager ? "Whole team" : "You"}</Flag>
                </span>
              </div>
              <div className="panel__body">
                {analytics && analytics.by_employee.length > 0 ? (
                  <BarChart
                    buckets={analytics.by_employee}
                    label="Spend by employee"
                    tone="alt"
                    emptyLabel="No approved spend yet."
                  />
                ) : (
                  <EmptyState
                    title="Nobody has approved spend yet"
                    body="Approved and reimbursed reports roll up here per employee."
                  />
                )}
              </div>
            </section>
          </div>

          <section className="panel" aria-labelledby="recent-activity">
            <div className="panel__head">
              <h2 className="panel__title" id="recent-activity">
                Recent activity
              </h2>
              <Link className="panel__meta" to="/reports">
                All reports →
              </Link>
            </div>
            <div className="panel__body panel__body--flush">
              {summary.recent_reports.length > 0 ? (
                <RecentReports reports={summary.recent_reports} />
              ) : (
                <div className="panel__body">
                  <EmptyState
                    title="No reports yet"
                    body="Create your first expense report to see activity here."
                    action={
                      <Link className="btn btn--primary btn--sm" to="/reports">
                        New report
                      </Link>
                    }
                  />
                </div>
              )}
            </div>
          </section>
        </>
      ) : null}
    </>
  );
}

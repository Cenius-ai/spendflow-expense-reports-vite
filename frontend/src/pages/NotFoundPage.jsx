import { Link } from "react-router-dom";

import useDocumentTitle from "../lib/useDocumentTitle.js";

export default function NotFoundPage() {
  useDocumentTitle("Page not found");
  return (
    <div className="empty">
      <p className="empty__title">That page does not exist</p>
      <p className="empty__body">
        The link may be out of date. Everything in Spendflow is reachable from the dashboard and the
        reports list.
      </p>
      <div className="form-actions">
        <Link className="btn btn--primary btn--sm" to="/dashboard">
          Back to dashboard
        </Link>
        <Link className="btn btn--secondary btn--sm" to="/reports">
          Reports
        </Link>
      </div>
    </div>
  );
}

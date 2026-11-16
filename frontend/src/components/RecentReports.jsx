import { Link } from "react-router-dom";

import Money from "./Money.jsx";
import StatusBadge from "./StatusBadge.jsx";
import { relativeTime } from "../lib/format.js";

export default function RecentReports({ reports }) {
  return (
    <div className="table-scroll">
      <table className="table">
        <caption>Five most recently updated reports</caption>
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
          {reports.map((report) => (
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
  );
}

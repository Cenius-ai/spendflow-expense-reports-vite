import { statusLabel } from "../lib/format.js";

export default function StatusBadge({ status }) {
  return <span className={`badge badge--${status}`}>{statusLabel(status)}</span>;
}

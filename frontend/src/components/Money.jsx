import { formatCents } from "../lib/format.js";

export default function Money({ cents, className = "" }) {
  return <span className={className ? `num ${className}` : "num"}>{formatCents(cents)}</span>;
}

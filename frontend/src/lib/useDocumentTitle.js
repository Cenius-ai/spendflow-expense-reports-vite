import { useEffect } from "react";

/** Keep the browser tab title specific to the current screen. */
export default function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · Spendflow Expense Reports` : "Spendflow Expense Reports";
  }, [title]);
}

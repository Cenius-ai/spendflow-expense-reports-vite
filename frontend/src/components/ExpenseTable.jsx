import EmptyState from "./EmptyState.jsx";
import Money from "./Money.jsx";
import { CATEGORY_LABELS } from "../lib/validation.js";
import { formatDate } from "../lib/format.js";

export default function ExpenseTable({ expenses, canEdit, onEdit, onDelete, busyId }) {
  if (expenses.length === 0) {
    return (
      <EmptyState
        title="No expenses yet"
        body="Add the first receipt line and the report total updates as you go."
      />
    );
  }

  return (
    <div className="table-scroll">
      <table className="table">
        <caption>
          {expenses.length} {expenses.length === 1 ? "expense line" : "expense lines"} on this report
        </caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Merchant</th>
            <th scope="col">Category</th>
            <th scope="col" className="num">
              Amount
            </th>
            {canEdit ? (
              <th scope="col" className="num">
                Actions
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {expenses.map((expense) => (
            <tr key={expense.id}>
              <td data-label="Date">{formatDate(expense.expense_date)}</td>
              <td data-label="Merchant">
                {expense.merchant}
                {expense.notes ? <span className="table__sub">{expense.notes}</span> : null}
              </td>
              <td data-label="Category">{CATEGORY_LABELS[expense.category] || expense.category}</td>
              <td data-label="Amount" className="num">
                <Money cents={expense.amount_cents} />
              </td>
              {canEdit ? (
                <td data-label="Actions">
                  <div className="row-actions">
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => onEdit(expense)}
                      disabled={busyId === expense.id}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => onDelete(expense)}
                      disabled={busyId === expense.id}
                    >
                      {busyId === expense.id ? <span className="spinner" aria-hidden="true" /> : "Delete"}
                    </button>
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

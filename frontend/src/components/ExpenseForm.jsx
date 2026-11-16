import { useState } from "react";

import { CATEGORIES, validateExpense } from "../lib/validation.js";
import { todayIso } from "../lib/format.js";

const FIELD_IDS = {
  amount: "expense-amount",
  category: "expense-category",
  expense_date: "expense-date",
  merchant: "expense-merchant",
  notes: "expense-notes",
};

function toDraft(initial) {
  if (!initial) {
    return {
      amount: "",
      category: "travel",
      expense_date: todayIso(),
      merchant: "",
      notes: "",
    };
  }
  return {
    amount: (initial.amount_cents / 100).toFixed(2),
    category: initial.category,
    expense_date: initial.expense_date,
    merchant: initial.merchant,
    notes: initial.notes || "",
  };
}

export default function ExpenseForm({ initial, onSubmit, busy, formId = "expense-form" }) {
  const [draft, setDraft] = useState(() => toDraft(initial));
  const [errors, setErrors] = useState({});
  const isEdit = Boolean(initial);
  const today = todayIso();

  function update(field, value) {
    setDraft((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => {
      if (!previous[field]) return previous;
      const next = { ...previous };
      delete next[field];
      return next;
    });
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (busy) return;
    const found = validateExpense(draft, today);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      const first = Object.keys(found)[0];
      const node = document.getElementById(FIELD_IDS[first]);
      if (node && typeof node.focus === "function") node.focus();
      return;
    }
    onSubmit({
      amount: draft.amount.trim(),
      category: draft.category,
      expense_date: draft.expense_date,
      merchant: draft.merchant.trim(),
      notes: draft.notes.trim(),
    });
  }

  return (
    <form id={formId} className="form-grid" onSubmit={handleSubmit} noValidate>
      <div className="field">
        <label className="field__label" htmlFor={FIELD_IDS.amount}>
          Receipt amount (USD)
        </label>
        <input
          id={FIELD_IDS.amount}
          className="input"
          name="amount"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="42.50"
          value={draft.amount}
          onChange={(event) => update("amount", event.target.value)}
          aria-invalid={errors.amount ? "true" : undefined}
          aria-describedby={errors.amount ? "expense-amount-error" : "expense-amount-hint"}
        />
        {errors.amount ? (
          <span className="field__error" id="expense-amount-error">
            {errors.amount}
          </span>
        ) : (
          <span className="field__hint" id="expense-amount-hint">
            Two decimal places, greater than zero.
          </span>
        )}
      </div>

      <div className="form-grid form-grid--two">
        <div className="field">
          <label className="field__label" htmlFor={FIELD_IDS.category}>
            Category
          </label>
          <select
            id={FIELD_IDS.category}
            className="select"
            name="category"
            value={draft.category}
            onChange={(event) => update("category", event.target.value)}
            aria-invalid={errors.category ? "true" : undefined}
          >
            {CATEGORIES.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
          {errors.category ? <span className="field__error">{errors.category}</span> : null}
        </div>

        <div className="field">
          <label className="field__label" htmlFor={FIELD_IDS.expense_date}>
            Expense date
          </label>
          <input
            id={FIELD_IDS.expense_date}
            className="input"
            name="expense_date"
            type="date"
            max={today}
            value={draft.expense_date}
            onChange={(event) => update("expense_date", event.target.value)}
            aria-invalid={errors.expense_date ? "true" : undefined}
          />
          {errors.expense_date ? <span className="field__error">{errors.expense_date}</span> : null}
        </div>
      </div>

      <div className="field">
        <label className="field__label" htmlFor={FIELD_IDS.merchant}>
          Merchant or vendor
        </label>
        <input
          id={FIELD_IDS.merchant}
          className="input"
          name="merchant"
          type="text"
          autoComplete="off"
          placeholder="Delta Air Lines"
          value={draft.merchant}
          onChange={(event) => update("merchant", event.target.value)}
          aria-invalid={errors.merchant ? "true" : undefined}
        />
        {errors.merchant ? <span className="field__error">{errors.merchant}</span> : null}
      </div>

      <div className="field">
        <label className="field__label" htmlFor={FIELD_IDS.notes}>
          Notes (optional)
        </label>
        <textarea
          id={FIELD_IDS.notes}
          className="textarea"
          name="notes"
          placeholder="What was this for?"
          value={draft.notes}
          onChange={(event) => update("notes", event.target.value)}
          aria-invalid={errors.notes ? "true" : undefined}
        />
        {errors.notes ? <span className="field__error">{errors.notes}</span> : null}
      </div>

      {/* Enter-to-submit still works because this button is the form's default
          button; the visible primary action lives in the drawer footer and is
          associated through the `form` attribute. */}
      <button type="submit" className="visually-hidden" tabIndex={-1}>
        {isEdit ? "Save changes" : "Add expense"}
      </button>
    </form>
  );
}

/** Client-side mirrors of the server rules. The server is always authoritative. */

export const CATEGORIES = [
  { value: "travel", label: "Travel" },
  { value: "meals", label: "Meals" },
  { value: "software", label: "Software" },
  { value: "office", label: "Office" },
  { value: "other", label: "Other" },
];

export const CATEGORY_LABELS = CATEGORIES.reduce((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {});

const AMOUNT_SHAPE = /^\d+(\.\d{1,2})?$/;

export function validateAmount(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return "Enter the receipt amount";
  if (text.startsWith("-") || Number(text) < 0) return "Amount must be greater than zero";
  if (/^\d+\.\d{3,}$/.test(text)) return "Use at most two decimal places";
  if (!AMOUNT_SHAPE.test(text)) return "Enter an amount like 42.50";
  if (Number(text) <= 0) return "Amount must be greater than zero";
  return null;
}

export function validateExpense(draft, today) {
  const errors = {};
  const amountError = validateAmount(draft.amount);
  if (amountError) errors.amount = amountError;

  if (!CATEGORIES.some((category) => category.value === draft.category)) {
    errors.category = "Choose a category";
  }
  if (!draft.expense_date) {
    errors.expense_date = "Pick the expense date";
  } else if (draft.expense_date > today) {
    errors.expense_date = "Expense date cannot be in the future";
  }
  if (!String(draft.merchant ?? "").trim()) {
    errors.merchant = "Add the merchant or vendor name";
  } else if (String(draft.merchant).trim().length > 120) {
    errors.merchant = "Keep the merchant under 120 characters";
  }
  if (String(draft.notes ?? "").length > 500) {
    errors.notes = "Keep notes under 500 characters";
  }
  return errors;
}

export function validateReportTitle(title) {
  const text = String(title ?? "").trim();
  if (!text) return "Give the report a title";
  if (text.length > 120) return "Keep the title under 120 characters";
  return null;
}

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateLogin({ email, password }) {
  const errors = {};
  if (!String(email ?? "").trim()) errors.email = "Enter your email";
  else if (!EMAIL_SHAPE.test(String(email).trim())) errors.email = "Enter a valid email address";
  if (!String(password ?? "")) errors.password = "Enter your password";
  return errors;
}

/** Map a FastAPI 422 body onto per-field messages. */
export function fieldErrors(detail) {
  const errors = {};
  if (!Array.isArray(detail)) return errors;
  for (const item of detail) {
    const location = Array.isArray(item.loc) ? item.loc : [];
    const field = location.filter((part) => part !== "body" && part !== "query" && part !== "path").join(".");
    if (!field || errors[field]) continue;
    const message = String(item.msg || "").replace(/^Value error,\s*/i, "");
    errors[field] = message;
  }
  return errors;
}

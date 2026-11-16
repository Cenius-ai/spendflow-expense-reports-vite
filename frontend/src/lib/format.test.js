import assert from "node:assert/strict";
import test from "node:test";

import { formatCents, formatDate, initials, relativeTime, statusLabel, todayIso } from "./format.js";
import {
  fieldErrors,
  validateAmount,
  validateExpense,
  validateLogin,
  validateReportTitle,
} from "./validation.js";

test("money is formatted from integer cents", () => {
  assert.equal(formatCents(0), "$0.00");
  assert.equal(formatCents(4250), "$42.50");
  assert.equal(formatCents(1234567), "$12,345.67");
  assert.equal(formatCents(null), "$0.00");
});

test("dates parse API timestamps and calendar dates", () => {
  assert.equal(formatDate("2026-03-04"), "04 Mar 2026");
  assert.equal(formatDate("2026-03-04T09:15:00"), "04 Mar 2026");
  assert.equal(formatDate(null), "—");
});

test("relative time never emits negative or NaN output", () => {
  const now = Date.parse("2026-03-10T12:00:00Z");
  assert.equal(relativeTime("2026-03-10T11:30:00Z", now), "30 min ago");
  assert.equal(relativeTime("2026-03-09T12:00:00Z", now), "yesterday");
  assert.equal(relativeTime("2026-03-01T12:00:00Z", now), "9 days ago");
  assert.equal(relativeTime("2026-03-11T12:00:00Z", now), "just now");
  assert.equal(relativeTime(null, now), "—");
});

test("statuses and initials are humanised", () => {
  assert.equal(statusLabel("reimbursed"), "Reimbursed");
  assert.equal(statusLabel("submitted"), "Submitted");
  assert.equal(initials("Maya Chen"), "MC");
  assert.equal(initials("Cenius"), "CE");
});

test("todayIso is a local calendar date", () => {
  assert.match(todayIso(new Date(2026, 2, 4)), /^2026-03-04$/);
});

test("amount validation rejects zero, negatives and over-precise values", () => {
  assert.equal(validateAmount("42.50"), null);
  assert.equal(validateAmount("42"), null);
  assert.equal(validateAmount(""), "Enter the receipt amount");
  assert.equal(validateAmount("0"), "Amount must be greater than zero");
  assert.equal(validateAmount("-12.00"), "Amount must be greater than zero");
  assert.equal(validateAmount("42.505"), "Use at most two decimal places");
  assert.equal(validateAmount("abc"), "Enter an amount like 42.50");
});

test("expense validation mirrors the server rules", () => {
  const valid = {
    amount: "18.25",
    category: "meals",
    expense_date: "2026-03-01",
    merchant: "Blue Bottle Coffee",
    notes: "",
  };
  assert.deepEqual(validateExpense(valid, "2026-03-04"), {});

  const bad = validateExpense(
    { ...valid, amount: "0", category: "gambling", expense_date: "2026-04-01", merchant: " " },
    "2026-03-04",
  );
  assert.equal(bad.amount, "Amount must be greater than zero");
  assert.equal(bad.category, "Choose a category");
  assert.equal(bad.expense_date, "Expense date cannot be in the future");
  assert.equal(bad.merchant, "Add the merchant or vendor name");
});

test("login and report title validation", () => {
  assert.deepEqual(validateLogin({ email: "cenius@cenius.ai", password: "cenius" }), {});
  assert.equal(validateLogin({ email: "", password: "" }).email, "Enter your email");
  assert.equal(validateLogin({ email: "nope", password: "x" }).email, "Enter a valid email address");
  assert.equal(validateReportTitle("   "), "Give the report a title");
  assert.equal(validateReportTitle("Client visit"), null);
});

test("FastAPI 422 details map onto field names", () => {
  const errors = fieldErrors([
    { loc: ["body", "amount"], msg: "Input should be greater than 0" },
    { loc: ["body", "expense_date"], msg: "Value error, Expense date cannot be in the future" },
  ]);
  assert.equal(errors.amount, "Input should be greater than 0");
  assert.equal(errors.expense_date, "Expense date cannot be in the future");
  assert.deepEqual(fieldErrors("not-a-list"), {});
});

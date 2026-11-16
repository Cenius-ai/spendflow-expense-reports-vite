# Using Spendflow

A walkthrough of the real screens. Sign in at <http://localhost:5173/login> with
`maya@spendflow.dev` / `cenius` (employee) or `cenius@cenius.ai` / `cenius`
(manager).

## 1. Sign in

The sign-in screen has the product story on the left and the form on the right.
Email and password are validated per field, the password has a show/hide toggle,
and the demo accounts can be filled with one click. Wrong credentials always return
the same message — "Invalid email or password" — so accounts cannot be enumerated.
The JWT is stored in `localStorage`, so a page refresh keeps you signed in. The
header shows your name, your role and a **Log out** button.

## 2. Dashboard (`/dashboard`, also `/`)

- **Summary cards**: pending approval (count + money waiting), approved awaiting
  reimbursement, reimbursed to date, and drafts not yet submitted.
- **Spend by category** and **Spend by employee**: horizontal bars sorted highest
  to lowest with a dollar label on every bar. Only approved and reimbursed reports
  count, so pipeline noise never inflates the numbers. With no approved spend the
  panels show a friendly prompt instead of an empty chart.
- **Recent activity**: the five most recently updated reports with status badges.

Managers see the whole team; employees see only their own figures.

## 3. Reports (`/reports`)

A filter rail on the left (All / Draft / Submitted / Approved / Rejected /
Reimbursed with live counts) and the report table on the right: title, owner, line
count, total, status badge and when it last changed. The **New report** form sits at
the top — name the report, press Create, and you land on its detail page. With no
reports at all, a first-run panel takes the table's place and the title field is
focused for you.

## 4. Report detail (`/reports/:id`)

The working screen.

- **Draft (owner)**: **Add expense** opens a 480px slide-over with amount, category
  (Travel / Meals / Software / Office / Other), date, merchant and an optional note.
  Amounts must be greater than zero with at most two decimals, and the date can never
  be in the future — enforced in the browser *and* on the server. Each line can be
  edited or deleted while the report is a draft; the total recalculates every time.
  **Submit for approval** is refused with a plain message if the report has no lines.
- **Submitted**: the report is locked. A manager sees **Approve** and **Reject with
  note** (the note is required) and nobody can approve their own report.
- **Approved**: a manager sees **Mark reimbursed**, which stamps the date.
- **Rejected**: the rejection note and the reviewer's name are shown to the employee.
- Every action disables while in flight and reports success or failure inline.

## 5. Approvals (`/approvals`, managers only)

Two queues: reports waiting on your decision (owner, title, total, line count,
submitted date, with Approve / Reject inline) and approved reports awaiting
reimbursement. Approving a report moves it straight from one to the other, and the
employee's copy of the report updates immediately. Employees who open this route are
redirected to their reports — no approval controls are ever rendered for them.

## 6. What is deliberately missing

No self-service sign-up, no receipt upload, no multi-currency, no approval chains, no
email notifications, no payment execution, no exports. The full list is in the
README under *Non-goals*.

"""Translate ORM rows into API response models (cents stay integers)."""

from __future__ import annotations

from .models import Expense, Report
from .schemas import CATEGORY_LABELS, ExpenseOut, ReportDetail, ReportSummary, UserOut


def user_out(user) -> UserOut:
    return UserOut(id=user.id, email=user.email, full_name=user.full_name, role=user.role)


def expense_out(expense: Expense) -> ExpenseOut:
    return ExpenseOut(
        id=expense.id,
        report_id=expense.report_id,
        amount_cents=expense.amount_cents,
        category=expense.category,
        category_label=CATEGORY_LABELS.get(expense.category, expense.category.title()),
        expense_date=expense.expense_date,
        merchant=expense.merchant,
        notes=expense.notes,
        created_at=expense.created_at,
    )


def report_summary(report: Report) -> ReportSummary:
    expenses = report.expenses or []
    return ReportSummary(
        id=report.id,
        title=report.title,
        status=report.status,
        owner_id=report.owner_id,
        owner_name=report.owner.full_name if report.owner else "Unknown",
        reviewer_id=report.reviewer_id,
        reviewer_name=report.reviewer.full_name if report.reviewer else None,
        decision_note=report.decision_note,
        expense_count=len(expenses),
        total_cents=sum(item.amount_cents for item in expenses),
        submitted_at=report.submitted_at,
        decided_at=report.decided_at,
        reimbursed_at=report.reimbursed_at,
        created_at=report.created_at,
        updated_at=report.updated_at,
    )


def report_detail(report: Report) -> ReportDetail:
    summary = report_summary(report)
    return ReportDetail(
        **summary.model_dump(),
        expenses=[expense_out(expense) for expense in report.expenses or []],
    )

"""Report lifecycle rules: draft -> submitted -> approved/rejected -> reimbursed.

Every transition re-checks the status server-side; client-sent status is never
trusted.
"""

from __future__ import annotations

from datetime import datetime

from fastapi import HTTPException, status as http_status
from sqlalchemy.orm import Session

from .models import Expense, Report, Status, User, utcnow


def ensure_draft(report: Report) -> None:
    if report.status != Status.DRAFT:
        raise HTTPException(
            status_code=http_status.HTTP_409_CONFLICT,
            detail="This report is locked because it is no longer a draft",
        )


def touch(report: Report, moment: datetime | None = None) -> None:
    report.updated_at = moment or utcnow()


def submit_report(report: Report, actor: User) -> Report:
    if report.owner_id != actor.id:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="Only the report owner can submit it",
        )
    ensure_draft(report)
    if not report.title.strip():
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="Give the report a title before submitting",
        )
    if not report.expenses:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="Add at least one expense before submitting",
        )
    now = utcnow()
    report.status = Status.SUBMITTED
    report.submitted_at = now
    report.reviewer_id = None
    report.decided_at = None
    report.decision_note = None
    report.reimbursed_at = None
    touch(report, now)
    return report


def decide_report(report: Report, manager: User, decision: str, note: str | None) -> Report:
    if not manager.is_manager:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="Only a manager can approve or reject a report",
        )
    if report.owner_id == manager.id:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="You cannot decide on your own report",
        )
    if report.status != Status.SUBMITTED:
        raise HTTPException(
            status_code=http_status.HTTP_409_CONFLICT,
            detail="Only a submitted report can be approved or rejected",
        )
    if decision not in (Status.APPROVED, Status.REJECTED):
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="Decision must be approved or rejected",
        )
    if decision == Status.REJECTED and not (note or "").strip():
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="Add a note explaining the rejection",
        )
    now = utcnow()
    report.status = decision
    report.reviewer_id = manager.id
    report.decided_at = now
    report.decision_note = (note or "").strip() or None
    report.reimbursed_at = None
    touch(report, now)
    return report


def reimburse_report(report: Report, manager: User) -> Report:
    if not manager.is_manager:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="Only a manager can mark a report reimbursed",
        )
    if report.status != Status.APPROVED:
        raise HTTPException(
            status_code=http_status.HTTP_409_CONFLICT,
            detail="Only an approved report can be marked reimbursed",
        )
    now = utcnow()
    report.status = Status.REIMBURSED
    report.reimbursed_at = now
    touch(report, now)
    return report


def add_expense(report: Report, actor: User, expense: Expense) -> Expense:
    if report.owner_id != actor.id:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="Only the report owner can add expenses",
        )
    ensure_draft(report)
    expense.report_id = report.id
    expense.user_id = actor.id
    touch(report)
    return expense


def update_expense(expense: Expense, report: Report, actor: User) -> Expense:
    if report.owner_id != actor.id:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="Only the report owner can edit this expense",
        )
    ensure_draft(report)
    touch(report)
    return expense


def delete_expense(expense: Expense, report: Report, actor: User) -> None:
    if report.owner_id != actor.id:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="Only the report owner can delete this expense",
        )
    ensure_draft(report)
    touch(report)


def commit(db: Session) -> None:
    db.commit()

"""Expense line endpoints, scoped to the owner of a draft report."""

from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import get_current_user, load_own_report
from ..models import Expense, Report, User
from ..schemas import ExpenseCreate, ExpenseOut, ExpenseUpdate, ReportDetail
from ..serializers import expense_out, report_detail
from ..workflow import add_expense, commit, delete_expense, update_expense

router = APIRouter(prefix="/api", tags=["expenses"])


def to_cents(amount: Decimal) -> int:
    """Exact dollars -> integer cents conversion (no float drift)."""
    return int((amount * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def _reload_report(db: Session, report_id: int) -> Report:
    report = db.get(Report, report_id)
    if report is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    return report


@router.post("/reports/{report_id}/expenses", response_model=ReportDetail, status_code=status.HTTP_201_CREATED)
def create_expense(
    report_id: int,
    payload: ExpenseCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReportDetail:
    report = load_own_report(db, current_user, report_id)
    expense = Expense(
        amount_cents=to_cents(payload.amount),
        category=payload.category.value,
        expense_date=payload.expense_date,
        merchant=payload.merchant,
        notes=payload.notes,
    )
    add_expense(report, current_user, expense)
    db.add(expense)
    commit(db)
    db.refresh(report)
    return report_detail(report)


@router.patch("/expenses/{expense_id}", response_model=ExpenseOut)
def update_expense_line(
    expense_id: int,
    payload: ExpenseUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ExpenseOut:
    expense = db.get(Expense, expense_id)
    if expense is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Expense not found")
    report = _reload_report(db, expense.report_id)
    update_expense(expense, report, current_user)

    if payload.amount is not None:
        expense.amount_cents = to_cents(payload.amount)
    if payload.category is not None:
        expense.category = payload.category.value
    if payload.expense_date is not None:
        expense.expense_date = payload.expense_date
    if payload.merchant is not None:
        expense.merchant = payload.merchant
    if payload.notes is not None:
        expense.notes = payload.notes or None

    commit(db)
    db.refresh(expense)
    return expense_out(expense)


@router.delete("/expenses/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_expense_line(
    expense_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    expense = db.get(Expense, expense_id)
    if expense is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Expense not found")
    report = _reload_report(db, expense.report_id)
    delete_expense(expense, report, current_user)
    db.delete(expense)
    commit(db)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

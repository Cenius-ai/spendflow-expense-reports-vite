"""Spend aggregates computed in SQL from approved + reimbursed reports only."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .models import Expense, Report, Status, User
from .schemas import CATEGORY_LABELS, SpendAnalytics, SpendBucket


def _scoped_statement(viewer: User, *columns):
    """Group expenses of approved/reimbursed reports, role-scoped to the viewer."""
    statement = (
        select(*columns)
        .join(Report, Expense.report_id == Report.id)
        .where(Report.status.in_(Status.SPEND))
    )
    if not viewer.is_manager:
        statement = statement.where(Report.owner_id == viewer.id)
    return statement


def spend_analytics(db: Session, viewer: User) -> SpendAnalytics:
    category_rows = db.execute(
        _scoped_statement(
            viewer,
            Expense.category,
            func.sum(Expense.amount_cents),
            func.count(func.distinct(Report.id)),
        ).group_by(Expense.category)
    ).all()

    employee_rows = db.execute(
        _scoped_statement(
            viewer,
            User.full_name,
            func.sum(Expense.amount_cents),
            func.count(func.distinct(Report.id)),
        )
        .join(User, Report.owner_id == User.id)
        .group_by(User.id, User.full_name)
    ).all()

    by_category = sorted(
        (
            SpendBucket(
                key=category,
                label=CATEGORY_LABELS.get(category, str(category).title()),
                total_cents=int(total or 0),
                report_count=int(report_count or 0),
            )
            for category, total, report_count in category_rows
        ),
        key=lambda bucket: (-bucket.total_cents, bucket.label),
    )

    by_employee = sorted(
        (
            SpendBucket(
                key=full_name,
                label=full_name,
                total_cents=int(total or 0),
                report_count=int(report_count or 0),
            )
            for full_name, total, report_count in employee_rows
        ),
        key=lambda bucket: (-bucket.total_cents, bucket.label),
    )

    return SpendAnalytics(
        scope="team" if viewer.is_manager else "mine",
        statuses_included=list(Status.SPEND),
        total_cents=sum(bucket.total_cents for bucket in by_category),
        by_category=by_category,
        by_employee=by_employee,
    )

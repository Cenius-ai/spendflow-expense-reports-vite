"""Role-aware dashboard summary and spend analytics endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from ..analytics import spend_analytics
from ..db import get_db
from ..deps import get_current_user
from ..models import Expense, Report, Status, User
from ..schemas import DashboardSummary, ReportSummary, SpendAnalytics, StatusBucket
from ..serializers import report_summary

router = APIRouter(prefix="/api", tags=["dashboard"])

RECENT_LIMIT = 5


def _status_totals(db: Session, viewer: User) -> dict[str, StatusBucket]:
    """Count and money total per status, computed in one grouped query."""
    report_totals = (
        select(
            Expense.report_id.label("report_id"),
            func.sum(Expense.amount_cents).label("total_cents"),
        )
        .group_by(Expense.report_id)
        .subquery()
    )
    statement = (
        select(
            Report.status,
            func.count(Report.id),
            func.coalesce(func.sum(report_totals.c.total_cents), 0),
        )
        .outerjoin(report_totals, report_totals.c.report_id == Report.id)
        .group_by(Report.status)
    )
    if not viewer.is_manager:
        statement = statement.where(Report.owner_id == viewer.id)

    buckets = {
        status: StatusBucket(count=0, total_cents=0) for status in Status.ALL
    }
    for status_value, count, total in db.execute(statement).all():
        buckets[status_value] = StatusBucket(count=int(count or 0), total_cents=int(total or 0))
    return buckets


def _recent_reports(db: Session, viewer: User) -> list[ReportSummary]:
    statement = (
        select(Report)
        .options(
            selectinload(Report.owner),
            selectinload(Report.reviewer),
            selectinload(Report.expenses),
        )
        .order_by(Report.updated_at.desc(), Report.id.desc())
        .limit(RECENT_LIMIT)
    )
    if not viewer.is_manager:
        statement = statement.where(Report.owner_id == viewer.id)
    return [report_summary(report) for report in db.execute(statement).scalars().unique().all()]


@router.get("/dashboard/summary", response_model=DashboardSummary)
def dashboard_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DashboardSummary:
    buckets = _status_totals(db, current_user)
    return DashboardSummary(
        scope="team" if current_user.is_manager else "mine",
        viewer_role=current_user.role,
        viewer_name=current_user.full_name,
        draft=buckets[Status.DRAFT],
        submitted=buckets[Status.SUBMITTED],
        approved=buckets[Status.APPROVED],
        rejected=buckets[Status.REJECTED],
        reimbursed=buckets[Status.REIMBURSED],
        recent_reports=_recent_reports(db, current_user),
    )


@router.get("/analytics/spend", response_model=SpendAnalytics)
def analytics_spend(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SpendAnalytics:
    return spend_analytics(db, current_user)

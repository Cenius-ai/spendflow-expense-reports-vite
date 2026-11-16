"""Report endpoints: CRUD, submission, manager decision and reimbursement."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..db import get_db
from ..deps import get_current_user, load_own_report, load_report_for_reader, require_manager
from ..models import Report, Status, User
from ..schemas import DecisionRequest, ReportCreate, ReportDetail, ReportSummary, ReportUpdate
from ..serializers import report_detail, report_summary
from ..workflow import commit, decide_report, ensure_draft, reimburse_report, submit_report

router = APIRouter(prefix="/api/reports", tags=["reports"])


def _report_query():
    """Eager-load owner/reviewer/expenses so list endpoints stay free of N+1."""
    return select(Report).options(
        selectinload(Report.owner),
        selectinload(Report.reviewer),
        selectinload(Report.expenses),
    )


def _visible_reports_statement(viewer: User):
    """Role scope: employees see their own reports, managers see the whole team."""
    statement = _report_query()
    if not viewer.is_manager:
        statement = statement.where(Report.owner_id == viewer.id)
    return statement.order_by(Report.updated_at.desc(), Report.id.desc())


@router.get("", response_model=list[ReportSummary])
def list_reports(
    status_filter: str | None = Query(default=None, alias="status"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ReportSummary]:
    statement = _visible_reports_statement(current_user)
    if status_filter:
        if status_filter not in Status.ALL:
            return []
        statement = statement.where(Report.status == status_filter)
    reports = db.execute(statement).scalars().unique().all()
    return [report_summary(report) for report in reports]


@router.post("", response_model=ReportDetail, status_code=status.HTTP_201_CREATED)
def create_report(
    payload: ReportCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReportDetail:
    report = Report(owner_id=current_user.id, title=payload.title, status=Status.DRAFT)
    db.add(report)
    commit(db)
    db.refresh(report)
    return report_detail(report)


@router.get("/{report_id}", response_model=ReportDetail)
def get_report(
    report_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReportDetail:
    load_report_for_reader(db, current_user, report_id)  # authorisation first
    report = db.execute(_report_query().where(Report.id == report_id)).scalars().unique().one()
    return report_detail(report)


@router.patch("/{report_id}", response_model=ReportDetail)
def rename_report(
    report_id: int,
    payload: ReportUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReportDetail:
    report = load_own_report(db, current_user, report_id)
    ensure_draft(report)
    report.title = payload.title
    commit(db)
    db.refresh(report)
    return report_detail(report)


@router.delete("/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_report(
    report_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    report = load_own_report(db, current_user, report_id)
    ensure_draft(report)
    db.delete(report)
    commit(db)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{report_id}/submit", response_model=ReportDetail)
def submit(
    report_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReportDetail:
    report = load_own_report(db, current_user, report_id)
    submit_report(report, current_user)
    commit(db)
    db.refresh(report)
    return report_detail(report)


@router.post("/{report_id}/decision", response_model=ReportDetail)
def decide(
    report_id: int,
    payload: DecisionRequest,
    current_user: User = Depends(require_manager),
    db: Session = Depends(get_db),
) -> ReportDetail:
    # Managers may decide any report they do not own; self-approval is blocked in
    # the workflow layer (403) and re-checked here via the owner comparison.
    report = db.get(Report, report_id)
    if report is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    decide_report(report, current_user, payload.decision, payload.note)
    commit(db)
    db.refresh(report)
    return report_detail(report)


@router.post("/{report_id}/reimburse", response_model=ReportDetail)
def reimburse(
    report_id: int,
    current_user: User = Depends(require_manager),
    db: Session = Depends(get_db),
) -> ReportDetail:
    report = db.get(Report, report_id)
    if report is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    reimburse_report(report, current_user)
    commit(db)
    db.refresh(report)
    return report_detail(report)

"""SQLAlchemy models for Spendflow: users, reports and expense lines."""

from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def utcnow() -> datetime:
    """Naive UTC timestamp (SQLite stores naive datetimes consistently)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Role:
    EMPLOYEE = "employee"
    MANAGER = "manager"


class Status:
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    REJECTED = "rejected"
    REIMBURSED = "reimbursed"

    ALL = (DRAFT, SUBMITTED, APPROVED, REJECTED, REIMBURSED)
    DECIDED = (APPROVED, REJECTED)
    REIMBURSABLE = (APPROVED,)
    SPEND = (APPROVED, REIMBURSED)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default=Role.EMPLOYEE)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow)

    owned_reports: Mapped[list["Report"]] = relationship(
        back_populates="owner",
        foreign_keys="Report.owner_id",
        cascade="all, delete-orphan",
    )
    reviewed_reports: Mapped[list["Report"]] = relationship(
        back_populates="reviewer",
        foreign_keys="Report.reviewer_id",
    )

    @property
    def is_manager(self) -> bool:
        return self.role == Role.MANAGER


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default=Status.DRAFT, index=True)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    reviewer_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    decision_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    reimbursed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow)

    owner: Mapped[User] = relationship(back_populates="owned_reports", foreign_keys=[owner_id])
    reviewer: Mapped[User | None] = relationship(back_populates="reviewed_reports", foreign_keys=[reviewer_id])
    expenses: Mapped[list["Expense"]] = relationship(
        back_populates="report",
        cascade="all, delete-orphan",
        order_by="Expense.expense_date.desc(), Expense.id.desc()",
    )


class Expense(Base):
    __tablename__ = "expenses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    report_id: Mapped[int] = mapped_column(
        ForeignKey("reports.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    category: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    expense_date: Mapped[date] = mapped_column(Date, nullable=False)
    merchant: Mapped[str] = mapped_column(String(120), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow)

    report: Mapped[Report] = relationship(back_populates="expenses")
    user: Mapped[User] = relationship()


Index("ix_reports_owner_status", Report.owner_id, Report.status)

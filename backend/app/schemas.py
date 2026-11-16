"""Pydantic v2 request/response schemas.

Request models are the server-side boundary: unknown fields are rejected and
every constraint the UI hints at is enforced here as well.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator


class Category(str, Enum):
    travel = "travel"
    meals = "meals"
    software = "software"
    office = "office"
    other = "other"


CATEGORY_LABELS: dict[str, str] = {
    "travel": "Travel",
    "meals": "Meals",
    "software": "Software",
    "office": "Office",
    "other": "Other",
}


class Status(str, Enum):
    draft = "draft"
    submitted = "submitted"
    approved = "approved"
    rejected = "rejected"
    reimbursed = "reimbursed"


# --------------------------------------------------------------------------- #
# auth
# --------------------------------------------------------------------------- #
class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    password: str = Field(min_length=1, max_length=200)


class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    role: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_at: datetime
    user: UserOut


# --------------------------------------------------------------------------- #
# reports
# --------------------------------------------------------------------------- #
class ReportCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=120)

    @field_validator("title")
    @classmethod
    def _title_not_blank(cls, value: str) -> str:
        cleaned = " ".join(value.split())
        if not cleaned:
            raise ValueError("Give the report a title")
        return cleaned


class ReportUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=120)

    @field_validator("title")
    @classmethod
    def _title_not_blank(cls, value: str) -> str:
        cleaned = " ".join(value.split())
        if not cleaned:
            raise ValueError("Give the report a title")
        return cleaned


class DecisionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    decision: Literal["approved", "rejected"]
    note: str | None = Field(default=None, max_length=1000)

    @model_validator(mode="after")
    def _note_required_for_rejection(self) -> "DecisionRequest":
        if self.note is not None:
            self.note = self.note.strip() or None
        if self.decision == "rejected" and not self.note:
            raise ValueError("Add a note explaining the rejection")
        return self


# --------------------------------------------------------------------------- #
# expenses
# --------------------------------------------------------------------------- #
class ExpenseCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    amount: Decimal = Field(gt=0, max_digits=10, decimal_places=2)
    category: Category
    expense_date: date
    merchant: str = Field(min_length=1, max_length=120)
    notes: str | None = Field(default=None, max_length=500)

    @field_validator("expense_date")
    @classmethod
    def _not_in_the_future(cls, value: date) -> date:
        if value > date.today():
            raise ValueError("Expense date cannot be in the future")
        return value

    @field_validator("merchant")
    @classmethod
    def _merchant_not_blank(cls, value: str) -> str:
        cleaned = " ".join(value.split())
        if not cleaned:
            raise ValueError("Add the merchant or vendor name")
        return cleaned

    @field_validator("notes")
    @classmethod
    def _clean_notes(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None


class ExpenseUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    amount: Decimal | None = Field(default=None, gt=0, max_digits=10, decimal_places=2)
    category: Category | None = None
    expense_date: date | None = None
    merchant: str | None = Field(default=None, min_length=1, max_length=120)
    notes: str | None = Field(default=None, max_length=500)

    @field_validator("expense_date")
    @classmethod
    def _not_in_the_future(cls, value: date | None) -> date | None:
        if value is not None and value > date.today():
            raise ValueError("Expense date cannot be in the future")
        return value

    @field_validator("merchant")
    @classmethod
    def _merchant_not_blank(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = " ".join(value.split())
        if not cleaned:
            raise ValueError("Add the merchant or vendor name")
        return cleaned


# --------------------------------------------------------------------------- #
# responses
# --------------------------------------------------------------------------- #
class ExpenseOut(BaseModel):
    id: int
    report_id: int
    amount_cents: int
    category: str
    category_label: str
    expense_date: date
    merchant: str
    notes: str | None = None
    created_at: datetime


class ReportSummary(BaseModel):
    id: int
    title: str
    status: str
    owner_id: int
    owner_name: str
    reviewer_id: int | None = None
    reviewer_name: str | None = None
    decision_note: str | None = None
    expense_count: int
    total_cents: int
    submitted_at: datetime | None = None
    decided_at: datetime | None = None
    reimbursed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class ReportDetail(ReportSummary):
    expenses: list[ExpenseOut] = Field(default_factory=list)


class StatusBucket(BaseModel):
    count: int
    total_cents: int


class DashboardSummary(BaseModel):
    scope: Literal["mine", "team"]
    viewer_role: str
    viewer_name: str
    draft: StatusBucket
    submitted: StatusBucket
    approved: StatusBucket
    rejected: StatusBucket
    reimbursed: StatusBucket
    recent_reports: list[ReportSummary]


class SpendBucket(BaseModel):
    key: str
    label: str
    total_cents: int
    report_count: int = 0


class SpendAnalytics(BaseModel):
    scope: Literal["mine", "team"]
    statuses_included: list[str]
    total_cents: int
    by_category: list[SpendBucket]
    by_employee: list[SpendBucket]

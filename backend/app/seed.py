"""Seed data for Spendflow.

Idempotent: every row is looked up before it is inserted, so running
``python3 -m seed`` twice never duplicates anything. The demo accounts are hashed
through the same bcrypt path the login endpoint verifies.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .db import SessionLocal, create_schema
from .models import Expense, Report, Role, Status, User, utcnow
from .security import hash_password

# The platform's standard demo login. Password is never stored in plaintext.
DEMO_EMAIL = "cenius@cenius.ai"
DEMO_PASSWORD = "cenius"

SEED_USERS = [
    {
        "email": DEMO_EMAIL,
        "full_name": "Cenius Demo",
        "role": Role.MANAGER,
        "password": DEMO_PASSWORD,
    },
    {
        "email": "maya@spendflow.dev",
        "full_name": "Maya Chen",
        "role": Role.EMPLOYEE,
        "password": DEMO_PASSWORD,
    },
    {
        "email": "leo@spendflow.dev",
        "full_name": "Leon Okafor",
        "role": Role.EMPLOYEE,
        "password": DEMO_PASSWORD,
    },
    {
        "email": "sam@spendflow.dev",
        "full_name": "Sam Rivera",
        "role": Role.EMPLOYEE,
        "password": DEMO_PASSWORD,
    },
]


def _days_ago(days: int) -> date:
    return date.today() - timedelta(days=days)


def _at(days_ago: int, hour: int = 10, minute: int = 0) -> datetime:
    """Naive UTC timestamp N days in the past, designed to look like office hours."""
    stamp = utcnow() - timedelta(days=days_ago)
    return stamp.replace(hour=hour, minute=minute, second=0, microsecond=0)


# (owner_email, title, status, submitted_days_ago, decided_days_ago, reimbursed_days_ago,
#  reviewer_email, decision_note, [(merchant, category, amount_cents, days_ago, notes)])
SEED_REPORTS = [
    (
        "maya@spendflow.dev",
        "Client visit — March",
        Status.APPROVED,
        24,
        22,
        None,
        DEMO_EMAIL,
        "Approved. Please use the rail fare cap next time.",
        [
            ("Delta Air Lines", "travel", 41280, 27, "SFO to SEA round trip"),
            ("Arlo Hotel Downtown", "travel", 31800, 26, "Two nights"),
            ("Canlis", "meals", 18750, 26, "Client dinner, 3 people"),
            ("Blue Bottle Coffee", "meals", 1840, 25, "Morning coffee, client meeting"),
            ("FedEx Office", "other", 1240, 25, "Shipping the signed contract"),
        ],
    ),
    (
        "maya@spendflow.dev",
        "Q2 design tooling",
        Status.REIMBURSED,
        52,
        50,
        45,
        DEMO_EMAIL,
        "Approved — annual renewals are fine when pre-agreed.",
        [
            ("Figma", "software", 18000, 55, "Annual seat renewal"),
            ("Adobe Creative Cloud", "software", 5999, 54, "Monthly licence"),
            ("Paper cut art supplies", "office", 4350, 53, "Sketch paper and markers"),
        ],
    ),
    (
        "maya@spendflow.dev",
        "Team lunch — offsite",
        Status.REJECTED,
        17,
        15,
        None,
        DEMO_EMAIL,
        "Missing the client dinner receipt — please re-submit with the itemised bill.",
        [
            ("Tartine Manufactory", "meals", 12640, 19, "Eight person team lunch"),
            ("Lyft", "travel", 2215, 19, "Ride to the studio"),
        ],
    ),
    (
        "maya@spendflow.dev",
        "Spring conference travel",
        Status.DRAFT,
        None,
        None,
        None,
        None,
        None,
        [
            ("Amtrak", "travel", 8900, 6, "Acela to the conference"),
            ("Hilton Midtown", "travel", 24500, 5, "Conference rate"),
        ],
    ),
    (
        "leo@spendflow.dev",
        "Berlin conference — engineering",
        Status.SUBMITTED,
        4,
        None,
        None,
        None,
        None,
        [
            ("Lufthansa", "travel", 68900, 12, "BER round trip"),
            ("Premier Inn Alexanderplatz", "travel", 43200, 11, "Four nights"),
            ("Katz Orange", "meals", 9840, 10, "Team dinner with two engineers"),
            ("BVG transit pass", "travel", 3210, 10, "Airport and city travel"),
        ],
    ),
    (
        "leo@spendflow.dev",
        "Engineering books and courses",
        Status.APPROVED,
        33,
        31,
        None,
        DEMO_EMAIL,
        "Approved.",
        [
            ("O'Reilly Media", "software", 4900, 36, "Designing Data-Intensive Applications"),
            ("Frontend Masters", "software", 3900, 35, "TypeScript deep dive"),
            ("No Starch Press", "office", 2750, 34, "Two paperbacks for the office shelf"),
        ],
    ),
    (
        "leo@spendflow.dev",
        "Home office setup",
        Status.DRAFT,
        None,
        None,
        None,
        None,
        None,
        [
            ("Autonomous SmartDesk", "office", 52900, 9, "Standing desk"),
        ],
    ),
    (
        "leo@spendflow.dev",
        "Client dinners — February",
        Status.REIMBURSED,
        68,
        66,
        60,
        DEMO_EMAIL,
        "Approved.",
        [
            ("Nopa", "meals", 21400, 71, "Two client dinners"),
            ("Saison", "meals", 38500, 70, "Closing dinner with the Acme team"),
            ("Uber", "travel", 4680, 70, "Rides to both dinners"),
        ],
    ),
    (
        "sam@spendflow.dev",
        "SaaS subscriptions — Q2",
        Status.SUBMITTED,
        2,
        None,
        None,
        None,
        None,
        [
            ("Linear", "software", 8000, 8, "Team plan"),
            ("Notion", "software", 6000, 8, "Plus plan"),
            ("Vercel", "software", 2000, 8, "Pro plan"),
            ("Google Workspace", "software", 1440, 8, "Two seats"),
        ],
    ),
    (
        "sam@spendflow.dev",
        "Airport parking and tolls",
        Status.APPROVED,
        21,
        19,
        None,
        DEMO_EMAIL,
        "Approved.",
        [
            ("SFO Long Term Parking", "travel", 12600, 23, "Four days"),
            ("Fastrak toll", "travel", 1750, 23, "Bridge tolls"),
        ],
    ),
    (
        "sam@spendflow.dev",
        "Recruiting dinners",
        Status.REJECTED,
        38,
        36,
        None,
        DEMO_EMAIL,
        "Two of these look personal — please split the candidate meals into their own report.",
        [
            ("State Bird Provisions", "meals", 16800, 41, "Candidate dinner"),
            ("Che Fico", "meals", 22400, 39, "Candidate dinner"),
        ],
    ),
    (
        "sam@spendflow.dev",
        "Product launch signage",
        Status.DRAFT,
        None,
        None,
        None,
        None,
        None,
        [],
    ),
    (
        "cenius@cenius.ai",
        "Founder retreat planning",
        Status.DRAFT,
        None,
        None,
        None,
        None,
        None,
        [
            ("Cavallo Point", "travel", 48000, 13, "Retreat deposit"),
        ],
    ),
]


def _get_or_create_user(db: Session, spec: dict) -> User:
    email = spec["email"].lower()
    user = db.execute(select(User).where(func.lower(User.email) == email)).scalar_one_or_none()
    if user is not None:
        return user
    user = User(
        email=email,
        full_name=spec["full_name"],
        role=spec["role"],
        password_hash=hash_password(spec["password"]),
    )
    db.add(user)
    db.flush()  # assign the primary key before children reference it
    return user


def _report_exists(db: Session, owner_id: int, title: str) -> bool:
    return (
        db.execute(
            select(Report.id).where(Report.owner_id == owner_id, Report.title == title).limit(1)
        ).first()
        is not None
    )


def seed_database(db: Session) -> dict[str, int]:
    """Insert demo users, reports and expenses when they are missing."""
    users = {spec["email"]: _get_or_create_user(db, spec) for spec in SEED_USERS}
    db.flush()

    created_reports = 0
    created_expenses = 0

    for (
        owner_email,
        title,
        status,
        submitted_days,
        decided_days,
        reimbursed_days,
        reviewer_email,
        note,
        expenses,
    ) in SEED_REPORTS:
        owner = users[owner_email]
        if _report_exists(db, owner.id, title):
            continue

        reviewer = users.get(reviewer_email) if reviewer_email else None
        submitted_at = _at(submitted_days, 9, 15) if submitted_days is not None else None
        decided_at = _at(decided_days, 16, 40) if decided_days is not None else None
        reimbursed_at = _at(reimbursed_days, 11, 5) if reimbursed_days is not None else None

        report = Report(
            owner_id=owner.id,
            title=title,
            status=status,
            submitted_at=submitted_at,
            reviewer_id=reviewer.id if reviewer else None,
            decided_at=decided_at,
            decision_note=note,
            reimbursed_at=reimbursed_at,
            created_at=(submitted_at or _at(28, 9, 0)) - timedelta(days=2),
            updated_at=reimbursed_at or decided_at or submitted_at or _at(3, 14, 0),
        )
        db.add(report)
        db.flush()
        created_reports += 1

        for merchant, category, amount_cents, days_ago, expense_note in expenses:
            db.add(
                Expense(
                    report_id=report.id,
                    user_id=owner.id,
                    amount_cents=amount_cents,
                    category=category,
                    expense_date=_days_ago(days_ago),
                    merchant=merchant,
                    notes=expense_note,
                    created_at=_at(max(days_ago - 1, 0), 12, 30),
                )
            )
            created_expenses += 1

    db.commit()
    return {"users": len(users), "reports": created_reports, "expenses": created_expenses}


def is_empty(db: Session) -> bool:
    return db.execute(select(func.count(User.id))).scalar_one() == 0


def run_seed(force_report: bool = True) -> dict[str, int]:
    """Create the schema and seed it. Safe to call on every boot."""
    create_schema()
    with SessionLocal() as db:
        result = seed_database(db)
    if force_report:
        print(
            "Spendflow seed: users={users} new_reports={reports} new_expenses={expenses}".format(
                **result
            )
        )
    return result


def main() -> None:
    run_seed()


if __name__ == "__main__":  # pragma: no cover - manual entry point
    main()

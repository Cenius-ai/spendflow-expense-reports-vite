"""End-to-end API tests for Spendflow: auth, expense CRUD, workflow, analytics."""

from __future__ import annotations

from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from app.db import create_schema
from app.main import app
from app.seed import DEMO_EMAIL, DEMO_PASSWORD, run_seed

MAYA = "maya@spendflow.dev"
LEO = "leo@spendflow.dev"


@pytest.fixture(scope="session")
def client():
    create_schema()
    run_seed(force_report=False)
    with TestClient(app) as test_client:  # triggers lifespan (schema + seed)
        yield test_client


def auth_headers(client: TestClient, email: str, password: str = DEMO_PASSWORD) -> dict[str, str]:
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


@pytest.fixture(scope="session")
def manager_headers(client: TestClient) -> dict[str, str]:
    return auth_headers(client, DEMO_EMAIL)


@pytest.fixture(scope="session")
def maya_headers(client: TestClient) -> dict[str, str]:
    return auth_headers(client, MAYA)


def new_report(client: TestClient, headers: dict[str, str], title: str) -> dict:
    response = client.post("/api/reports", json={"title": title}, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def add_expense(
    client: TestClient,
    headers: dict[str, str],
    report_id: int,
    *,
    amount: str = "42.50",
    category: str = "travel",
    expense_date: str | None = None,
    merchant: str = "Delta Air Lines",
) -> dict:
    payload = {
        "amount": amount,
        "category": category,
        "expense_date": expense_date or (date.today() - timedelta(days=7)).isoformat(),
        "merchant": merchant,
        "notes": "Added by the automated suite",
    }
    response = client.post(f"/api/reports/{report_id}/expenses", json=payload, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


# --------------------------------------------------------------------------- #
# auth
# --------------------------------------------------------------------------- #
def test_health_and_landing_page(client: TestClient):
    health = client.get("/health")
    assert health.status_code == 200
    assert health.json()["status"] == "ok"

    landing = client.get("/")
    assert landing.status_code == 200
    assert "text/html" in landing.headers["content-type"]
    assert "Spendflow" in landing.text


def test_login_returns_token_and_profile(client: TestClient):
    response = client.post(
        "/api/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["access_token"]
    assert body["token_type"] == "bearer"
    assert body["user"]["email"] == DEMO_EMAIL
    assert body["user"]["role"] == "manager"
    assert "password" not in response.text.lower() or "password_hash" not in response.text


def test_login_failures_share_one_message(client: TestClient):
    wrong_password = client.post(
        "/api/auth/login", json={"email": DEMO_EMAIL, "password": "***REDACTED-SECRET***"}
    )
    unknown_email = client.post(
        "/api/auth/login", json={"email": "nobody@spendflow.dev", "password": DEMO_PASSWORD}
    )
    assert wrong_password.status_code == 401
    assert unknown_email.status_code == 401
    assert wrong_password.json()["detail"] == unknown_email.json()["detail"] == "Invalid email or password"


def test_me_requires_a_token(client: TestClient):
    assert client.get("/api/auth/me").status_code == 401
    bad = client.get("/api/auth/me", headers={"Authorization": "Bearer ***REDACTED-SECRET***"})
    assert bad.status_code == 401

    ok = client.get("/api/auth/me", headers=auth_headers(client, MAYA))
    assert ok.status_code == 200
    assert ok.json()["email"] == MAYA


def test_every_data_route_requires_auth(client: TestClient):
    protected = [
        ("get", "/api/reports"),
        ("get", "/api/reports/1"),
        ("post", "/api/reports"),
        ("get", "/api/dashboard/summary"),
        ("get", "/api/analytics/spend"),
    ]
    for method, path in protected:
        request = getattr(client, method)
        response = request(path, json={"title": "nope"}) if method == "post" else request(path)
        assert response.status_code == 401, f"{method} {path} -> {response.status_code}"


# --------------------------------------------------------------------------- #
# report + expense CRUD
# --------------------------------------------------------------------------- #
def test_create_report_starts_as_empty_draft(client: TestClient, maya_headers: dict[str, str]):
    report = new_report(client, maya_headers, "Client visit — March QA")
    assert report["status"] == "draft"
    assert report["expense_count"] == 0
    assert report["total_cents"] == 0
    assert report["owner_name"] == "Maya Chen"


def test_add_expense_updates_report_total(client: TestClient, maya_headers: dict[str, str]):
    report = new_report(client, maya_headers, "Travel total QA")
    updated = add_expense(client, maya_headers, report["id"], amount="42.50")
    assert updated["total_cents"] == 4250
    assert updated["expense_count"] == 1
    line = updated["expenses"][0]
    assert line["amount_cents"] == 4250
    assert line["category"] == "travel"
    assert line["category_label"] == "Travel"

    fetched = client.get(f"/api/reports/{report['id']}", headers=maya_headers).json()
    assert fetched["total_cents"] == 4250


def test_edit_and_delete_expense_line(client: TestClient, maya_headers: dict[str, str]):
    report = new_report(client, maya_headers, "Edit delete QA")
    updated = add_expense(client, maya_headers, report["id"], amount="10.00")
    expense_id = updated["expenses"][0]["id"]

    patched = client.patch(
        f"/api/expenses/{expense_id}", json={"amount": "99.99"}, headers=maya_headers
    )
    assert patched.status_code == 200
    assert patched.json()["amount_cents"] == 9999
    detail = client.get(f"/api/reports/{report['id']}", headers=maya_headers).json()
    assert detail["total_cents"] == 9999

    deleted = client.delete(f"/api/expenses/{expense_id}", headers=maya_headers)
    assert deleted.status_code == 204
    detail = client.get(f"/api/reports/{report['id']}", headers=maya_headers).json()
    assert detail["expenses"] == []
    assert detail["total_cents"] == 0


@pytest.mark.parametrize(
    "payload",
    [
        {"amount": "0.00"},
        {"amount": "-12.00"},
        {"amount": "42.505"},
        {"expense_date": (date.today() + timedelta(days=1)).isoformat()},
        {"merchant": "   "},
        {"category": "gambling"},
    ],
)
def test_expense_validation_rejects_bad_input(
    client: TestClient, maya_headers: dict[str, str], payload: dict
):
    report = new_report(client, maya_headers, f"Validation QA {sorted(payload)[0]}")
    body = {
        "amount": "12.00",
        "category": "meals",
        "expense_date": (date.today() - timedelta(days=3)).isoformat(),
        "merchant": "Sweetgreen",
    }
    body.update(payload)
    response = client.post(f"/api/reports/{report['id']}/expenses", json=body, headers=maya_headers)
    assert response.status_code == 422, response.text
    detail = client.get(f"/api/reports/{report['id']}", headers=maya_headers).json()
    assert detail["expenses"] == []


def test_employee_cannot_read_or_touch_another_employees_report(
    client: TestClient, maya_headers: dict[str, str]
):
    leo_headers = auth_headers(client, LEO)
    leo_report = new_report(client, leo_headers, "Leo private report")

    forbidden = client.get(f"/api/reports/{leo_report['id']}", headers=maya_headers)
    assert forbidden.status_code == 403
    assert "title" not in forbidden.json()

    # The write paths enforce the same ownership predicate as the read paths.
    assert (
        client.post(
            f"/api/reports/{leo_report['id']}/expenses",
            json={
                "amount": "5.00",
                "category": "meals",
                "expense_date": date.today().isoformat(),
                "merchant": "Cafe",
            },
            headers=maya_headers,
        ).status_code
        == 403
    )
    assert client.delete(f"/api/reports/{leo_report['id']}", headers=maya_headers).status_code == 403

    # Employees cannot see other people's reports in the list either.
    titles = [row["title"] for row in client.get("/api/reports", headers=maya_headers).json()]
    assert "Leo private report" not in titles


def test_report_list_filters_by_status(client: TestClient, manager_headers: dict[str, str]):
    everything = client.get("/api/reports", headers=manager_headers).json()
    assert len(everything) >= 10
    statuses = {row["status"] for row in everything}
    assert {"draft", "submitted", "approved", "rejected", "reimbursed"} <= statuses

    approved = client.get("/api/reports?status=approved", headers=manager_headers).json()
    assert approved
    assert all(row["status"] == "approved" for row in approved)


# --------------------------------------------------------------------------- #
# workflow
# --------------------------------------------------------------------------- #
def test_submit_requires_at_least_one_expense(client: TestClient, maya_headers: dict[str, str]):
    report = new_report(client, maya_headers, "Empty submit QA")
    response = client.post(f"/api/reports/{report['id']}/submit", headers=maya_headers)
    assert response.status_code == 400
    assert response.json()["detail"] == "Add at least one expense before submitting"
    detail = client.get(f"/api/reports/{report['id']}", headers=maya_headers).json()
    assert detail["status"] == "draft"


def test_submit_locks_the_report(client: TestClient, maya_headers: dict[str, str]):
    report = new_report(client, maya_headers, "Submit locks QA")
    add_expense(client, maya_headers, report["id"])

    submitted = client.post(f"/api/reports/{report['id']}/submit", headers=maya_headers)
    assert submitted.status_code == 200, submitted.text
    body = submitted.json()
    assert body["status"] == "submitted"
    assert body["submitted_at"] is not None

    blocked = client.post(
        f"/api/reports/{report['id']}/expenses",
        json={
            "amount": "9.00",
            "category": "office",
            "expense_date": date.today().isoformat(),
            "merchant": "Staples",
        },
        headers=maya_headers,
    )
    assert blocked.status_code == 409
    assert client.delete(f"/api/reports/{report['id']}", headers=maya_headers).status_code == 409


def test_manager_approves_and_reimburses(client: TestClient, manager_headers: dict[str, str]):
    employee_headers = auth_headers(client, MAYA)
    report = new_report(client, employee_headers, "Approval flow QA")
    add_expense(client, employee_headers, report["id"], amount="120.00", category="meals")
    client.post(f"/api/reports/{report['id']}/submit", headers=employee_headers)

    approved = client.post(
        f"/api/reports/{report['id']}/decision",
        json={"decision": "approved", "note": "Looks good"},
        headers=manager_headers,
    )
    assert approved.status_code == 200, approved.text
    body = approved.json()
    assert body["status"] == "approved"
    assert body["reviewer_name"] == "Cenius Demo"
    assert body["decided_at"] is not None

    reimbursed = client.post(f"/api/reports/{report['id']}/reimburse", headers=manager_headers)
    assert reimbursed.status_code == 200, reimbursed.text
    assert reimbursed.json()["status"] == "reimbursed"
    assert reimbursed.json()["reimbursed_at"] is not None


def test_reject_requires_a_note(client: TestClient, manager_headers: dict[str, str]):
    employee_headers = auth_headers(client, LEO)
    report = new_report(client, employee_headers, "Rejection note QA")
    add_expense(client, employee_headers, report["id"])
    client.post(f"/api/reports/{report['id']}/submit", headers=employee_headers)

    empty_note = client.post(
        f"/api/reports/{report['id']}/decision",
        json={"decision": "rejected", "note": "   "},
        headers=manager_headers,
    )
    assert empty_note.status_code == 422

    rejected = client.post(
        f"/api/reports/{report['id']}/decision",
        json={"decision": "rejected", "note": "Missing the client dinner receipt"},
        headers=manager_headers,
    )
    assert rejected.status_code == 200
    body = rejected.json()
    assert body["status"] == "rejected"
    assert body["decision_note"] == "Missing the client dinner receipt"
    assert body["reviewer_name"] == "Cenius Demo"


def test_manager_cannot_decide_their_own_report(client: TestClient, manager_headers: dict[str, str]):
    report = new_report(client, manager_headers, "Manager self approval QA")
    add_expense(client, manager_headers, report["id"])
    client.post(f"/api/reports/{report['id']}/submit", headers=manager_headers)

    response = client.post(
        f"/api/reports/{report['id']}/decision",
        json={"decision": "approved"},
        headers=manager_headers,
    )
    assert response.status_code == 403


def test_employee_cannot_decide_or_reimburse(client: TestClient, maya_headers: dict[str, str]):
    employee_headers = auth_headers(client, LEO)
    report = new_report(client, employee_headers, "Employee cannot decide QA")
    add_expense(client, employee_headers, report["id"])
    client.post(f"/api/reports/{report['id']}/submit", headers=employee_headers)

    decision = client.post(
        f"/api/reports/{report['id']}/decision",
        json={"decision": "approved"},
        headers=maya_headers,
    )
    assert decision.status_code == 403
    assert client.post(f"/api/reports/{report['id']}/reimburse", headers=maya_headers).status_code == 403


def test_reimburse_requires_an_approved_report(client: TestClient, manager_headers: dict[str, str]):
    employee_headers = auth_headers(client, LEO)
    report = new_report(client, employee_headers, "Reimburse guard QA")
    add_expense(client, employee_headers, report["id"])
    client.post(f"/api/reports/{report['id']}/submit", headers=employee_headers)

    response = client.post(f"/api/reports/{report['id']}/reimburse", headers=manager_headers)
    assert response.status_code == 409


# --------------------------------------------------------------------------- #
# dashboard + analytics
# --------------------------------------------------------------------------- #
def test_dashboard_summary_is_role_scoped(client: TestClient, manager_headers, maya_headers):
    manager_summary = client.get("/api/dashboard/summary", headers=manager_headers).json()
    employee_summary = client.get("/api/dashboard/summary", headers=maya_headers).json()
    assert manager_summary["scope"] == "team"
    assert employee_summary["scope"] == "mine"
    assert manager_summary["submitted"]["count"] >= employee_summary["submitted"]["count"]
    assert len(manager_summary["recent_reports"]) == 5

    # The employee's totals must equal the sum of the reports the employee can see.
    approved = client.get("/api/reports?status=approved", headers=maya_headers).json()
    assert employee_summary["approved"]["count"] == len(approved)
    assert employee_summary["approved"]["total_cents"] == sum(r["total_cents"] for r in approved)


def test_analytics_only_counts_approved_and_reimbursed(
    client: TestClient, manager_headers: dict[str, str]
):
    before = client.get("/api/analytics/spend", headers=manager_headers).json()
    assert before["by_category"], "seed data should produce category buckets"
    assert before["by_employee"]
    totals = [bucket["total_cents"] for bucket in before["by_category"]]
    assert totals == sorted(totals, reverse=True)

    # A draft (and a submitted) report must not move the approved-spend numbers.
    employee_headers = auth_headers(client, LEO)
    draft = new_report(client, employee_headers, "Uncounted draft QA")
    add_expense(client, employee_headers, draft["id"], amount="999.99", category="other")
    submitted = new_report(client, employee_headers, "Uncounted submitted QA")
    add_expense(client, employee_headers, submitted["id"], amount="888.88", category="other")
    client.post(f"/api/reports/{submitted['id']}/submit", headers=employee_headers)

    after = client.get("/api/analytics/spend", headers=manager_headers).json()
    assert after["by_category"] == before["by_category"]
    assert after["total_cents"] == before["total_cents"]


def test_analytics_employee_scope_only_sees_own_spend(client: TestClient, maya_headers):
    payload = client.get("/api/analytics/spend", headers=maya_headers).json()
    assert payload["scope"] == "mine"
    assert len(payload["by_employee"]) == 1
    assert payload["by_employee"][0]["label"] == "Maya Chen"

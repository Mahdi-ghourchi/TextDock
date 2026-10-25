from collections.abc import Generator
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app import main as main_module
from app import cleanup as cleanup_module
from app.database import Base, build_session_factory, get_session
from app.main import create_app
from app.models import Share
from app.schemas import ShareCreate
from app.security import capability_hash, capability_matches


@pytest.fixture
def client(tmp_path, monkeypatch) -> Generator[TestClient, None, None]:
    factory = build_session_factory(f"sqlite:///{tmp_path / 'test.sqlite'}")
    engine = factory.kw["bind"]
    Base.metadata.create_all(engine)
    monkeypatch.setattr(main_module, "SessionFactory", factory)

    def override_session() -> Generator[Session, None, None]:
        session = factory()
        try:
            yield session
        finally:
            session.close()

    app = create_app()
    app.state.session_factory = factory
    app.dependency_overrides[get_session] = override_session
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    engine.dispose()


def make_request(**overrides: object) -> dict[str, object]:
    return {
        "title": "  Launch notes  ",
        "content": "# Draft\n\nNot published until I share.",
        "format": "markdown",
        "expires_in_hours": 24,
        **overrides,
    }


def test_share_is_a_read_only_snapshot_and_stores_only_hashes(client: TestClient) -> None:
    created = client.post("/api/v1/shares", json=make_request())

    assert created.status_code == 201
    assert created.headers["cache-control"] == "no-store"
    share_data = created.json()
    assert share_data["access_token"]
    assert share_data["revoke_capability"]

    response = client.get(
        f"/api/v1/shares/{share_data['id']}",
        headers={"Authorization": f"Bearer {share_data['access_token']}"},
    )
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert response.json()["title"] == "Launch notes"
    assert response.json()["content"] == "# Draft\n\nNot published until I share."
    assert "access_token" not in response.json()
    assert "revoke_capability" not in response.json()

    session_factory = client.app.state.session_factory
    with session_factory() as session:
        stored = session.get(Share, share_data["id"])
        assert stored is not None
        assert stored.access_token_hash == capability_hash(share_data["access_token"])
        assert stored.revoke_capability_hash == capability_hash(share_data["revoke_capability"])
        assert stored.access_token_hash != share_data["access_token"]
        assert stored.revoke_capability_hash != share_data["revoke_capability"]


def test_share_requires_the_matching_bearer_capability(client: TestClient) -> None:
    created = client.post("/api/v1/shares", json=make_request()).json()
    assert client.get(f"/api/v1/shares/{created['id']}").status_code == 401
    assert client.get(
        f"/api/v1/shares/{created['id']}",
        headers={"Authorization": "Bearer wrong-token"},
    ).status_code == 404


def test_revocation_requires_its_separate_capability(client: TestClient) -> None:
    created = client.post("/api/v1/shares", json=make_request()).json()
    path = f"/api/v1/shares/{created['id']}"
    assert client.delete(path, headers={"X-Revoke-Capability": "wrong"}).status_code == 404
    assert client.delete(path, headers={"X-Revoke-Capability": created["revoke_capability"]}).status_code == 204
    assert client.delete(path, headers={"X-Revoke-Capability": created["revoke_capability"]}).status_code == 204
    assert client.get(path, headers={"Authorization": f"Bearer {created['access_token']}"}).status_code == 410
    factory = client.app.state.session_factory
    with factory() as session:
        stored = session.get(Share, created["id"])
        assert stored is not None
        assert stored.content == ""
        assert stored.title == "Unavailable snapshot"


def test_expired_share_is_not_readable(client: TestClient, monkeypatch) -> None:
    from app.routes import shares

    monkeypatch.setattr(
        shares,
        "expiration_from_hours",
        lambda _hours: datetime.now(timezone.utc) - timedelta(seconds=1),
    )
    created = client.post("/api/v1/shares", json=make_request()).json()
    response = client.get(
        f"/api/v1/shares/{created['id']}",
        headers={"Authorization": f"Bearer {created['access_token']}"},
    )
    assert response.status_code == 410
    factory = client.app.state.session_factory
    with factory() as session:
        stored = session.get(Share, created["id"])
        assert stored is not None
        assert stored.content == ""


def test_invalid_expiry_and_blank_title_are_rejected(client: TestClient) -> None:
    assert client.post("/api/v1/shares", json=make_request(title="  ")).status_code == 422
    assert client.post("/api/v1/shares", json=make_request(expires_in_hours=48)).status_code == 422


def test_utf8_byte_limit_is_enforced() -> None:
    with pytest.raises(ValueError, match="1 MB or smaller"):
        ShareCreate.model_validate(make_request(content="é" * 500_001))
    with pytest.raises(ValueError, match="valid string"):
        ShareCreate.model_validate(make_request(content="\ud800"))


def test_health_endpoints_report_database_readiness(client: TestClient) -> None:
    assert client.get("/health/live").json() == {"status": "ok"}
    assert client.get("/health/ready").json() == {"status": "ok"}


def test_request_body_limit_rejects_oversized_payload(client: TestClient) -> None:
    response = client.post(
        "/api/v1/shares",
        content=b"x" * 6_100_001,
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 413


def test_invalid_content_length_is_rejected(client: TestClient) -> None:
    response = client.post(
        "/api/v1/shares",
        content=b"",
        headers={"Content-Type": "application/json", "Content-Length": "not-a-number"},
    )
    assert response.status_code == 400


def test_capability_comparison_matches_only_the_original_secret() -> None:
    digest = capability_hash("high-entropy-secret")
    assert capability_matches("high-entropy-secret", digest)
    assert not capability_matches("different-secret", digest)


def test_retention_cleanup_removes_old_expired_and_revoked_records(client: TestClient, monkeypatch) -> None:
    from datetime import timedelta

    now = datetime.now(timezone.utc)
    factory = client.app.state.session_factory
    monkeypatch.setattr(cleanup_module, "SessionFactory", factory)
    with factory() as session:
        session.add_all([
            Share(
                id="expired-old",
                title="Old",
                content="",
                document_format="text",
                access_token_hash=capability_hash("a"),
                revoke_capability_hash=capability_hash("b"),
                created_at=now - timedelta(days=40),
                expires_at=now - timedelta(days=31),
            ),
            Share(
                id="revoked-old",
                title="Unavailable snapshot",
                content="",
                document_format="text",
                access_token_hash=capability_hash("c"),
                revoke_capability_hash=capability_hash("d"),
                created_at=now - timedelta(days=40),
                expires_at=now + timedelta(days=1),
                revoked_at=now - timedelta(days=31),
            ),
            Share(
                id="still-retained",
                title="Recent",
                content="",
                document_format="text",
                access_token_hash=capability_hash("e"),
                revoke_capability_hash=capability_hash("f"),
                created_at=now - timedelta(days=1),
                expires_at=now - timedelta(days=1),
            ),
        ])
        session.commit()

    assert cleanup_module.purge_old_shares() == 2
    with factory() as session:
        assert session.get(Share, "expired-old") is None
        assert session.get(Share, "revoked-old") is None
        assert session.get(Share, "still-retained") is not None

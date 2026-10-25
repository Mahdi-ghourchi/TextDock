from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.database import get_session
from app.models import Share
from app.schemas import ShareCreate, ShareCreated, ShareSnapshot, expiration_from_hours
from app.security import capability_hash, capability_matches, create_capability

router = APIRouter(prefix="/api/v1/shares", tags=["shares"])
bearer = HTTPBearer(auto_error=False)
SessionDependency = Annotated[Session, Depends(get_session)]
OptionalBearer = Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]


@router.post("", response_model=ShareCreated, status_code=status.HTTP_201_CREATED)
def create_share(request: ShareCreate, session: SessionDependency, response: Response) -> ShareCreated:
    response.headers["Cache-Control"] = "no-store"
    access_token = create_capability()
    revoke_capability = create_capability()
    created_at = datetime.now(timezone.utc)
    share = Share(
        id=create_capability(),
        title=request.title,
        content=request.content,
        document_format=request.format,
        access_token_hash=capability_hash(access_token),
        revoke_capability_hash=capability_hash(revoke_capability),
        created_at=created_at,
        expires_at=expiration_from_hours(request.expires_in_hours),
    )
    session.add(share)
    session.commit()
    return ShareCreated(
        id=share.id,
        access_token=access_token,
        revoke_capability=revoke_capability,
        created_at=share.created_at,
        expires_at=share.expires_at,
    )


@router.get("/{share_id}", response_model=ShareSnapshot)
def read_share(
    share_id: str,
    session: SessionDependency,
    credentials: OptionalBearer,
    response: Response,
) -> ShareSnapshot:
    response.headers["Cache-Control"] = "no-store"
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="A share access token is required.", headers={"WWW-Authenticate": "Bearer"})
    share = session.get(Share, share_id)
    if share is None or not capability_matches(credentials.credentials, share.access_token_hash):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Snapshot not found.")
    if share.revoked_at is not None or is_expired(share.expires_at):
        if share.content:
            share.content = ""
            session.commit()
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="This snapshot has expired or was revoked.")
    return ShareSnapshot(
        id=share.id,
        title=share.title,
        content=share.content,
        format=share.document_format,  # type: ignore[arg-type]
        created_at=share.created_at,
        expires_at=share.expires_at,
    )


@router.delete("/{share_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_share(
    share_id: str,
    session: SessionDependency,
    revoke_capability: Annotated[str | None, Header(alias="X-Revoke-Capability")] = None,
) -> Response:
    share = session.get(Share, share_id)
    if share is None or revoke_capability is None or not capability_matches(revoke_capability, share.revoke_capability_hash):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Snapshot not found.")
    if share.revoked_at is None:
        share.revoked_at = datetime.now(timezone.utc)
        share.title = "Unavailable snapshot"
        share.content = ""
        session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def is_expired(expires_at: datetime) -> bool:
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    return expires_at <= datetime.now(timezone.utc)

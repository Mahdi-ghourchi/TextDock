from datetime import datetime, timedelta, timezone

from sqlalchemy import delete

from app.database import SessionFactory
from app.models import Share


def purge_old_shares() -> int:
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    with SessionFactory() as session:
        result = session.execute(
            delete(Share).where(
                (Share.expires_at < cutoff) | (Share.revoked_at < cutoff)
            )
        )
        session.commit()
        return result.rowcount or 0


if __name__ == "__main__":
    print(f"Purged {purge_old_shares()} expired or revoked share records.")

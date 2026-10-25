import hashlib
import secrets


def create_capability() -> str:
    return secrets.token_urlsafe(32)


def capability_hash(capability: str) -> str:
    return hashlib.sha256(capability.encode("utf-8")).hexdigest()


def capability_matches(capability: str, expected_hash: str) -> bool:
    return secrets.compare_digest(capability_hash(capability), expected_hash)

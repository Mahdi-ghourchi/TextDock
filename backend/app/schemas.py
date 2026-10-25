from datetime import datetime, timedelta, timezone
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class ShareCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    content: str = Field(max_length=1_000_000)
    format: Literal["markdown", "text"]
    expires_in_hours: Literal[24, 168, 720] = 168

    @field_validator("title")
    @classmethod
    def clean_title(cls, value: str) -> str:
        value = " ".join(value.split())
        if not value:
            raise ValueError("Title must contain non-whitespace text.")
        if any(ord(char) < 32 or ord(char) == 127 for char in value):
            raise ValueError("Title cannot contain control characters.")
        return value

    @model_validator(mode="after")
    def check_content_bytes(self) -> "ShareCreate":
        try:
            content_bytes = len(self.content.encode("utf-8"))
        except UnicodeEncodeError as error:
            raise ValueError("Content must contain valid Unicode text.") from error
        if content_bytes > 1_000_000:
            raise ValueError("Content must be 1 MB or smaller when encoded as UTF-8.")
        return self


class ShareCreated(BaseModel):
    id: str
    access_token: str
    revoke_capability: str
    created_at: datetime
    expires_at: datetime


class ShareSnapshot(BaseModel):
    id: str
    title: str
    content: str
    format: Literal["markdown", "text"]
    created_at: datetime
    expires_at: datetime

    model_config = ConfigDict(from_attributes=True)


def expiration_from_hours(hours: int) -> datetime:
    return datetime.now(timezone.utc) + timedelta(hours=hours)

from sqlalchemy import String, Text, DateTime, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime

from app.db import Base


class JudgeSubmissionEntity(Base):
    __tablename__ = "judge_submissions"

    id: Mapped[str] = mapped_column(
        String,
        primary_key=True
    )

    language: Mapped[str] = mapped_column(String)

    code: Mapped[str] = mapped_column(Text)

    status: Mapped[str] = mapped_column(String)

    stop_on_failure: Mapped[bool] = mapped_column(
        Boolean
    )

    result_json: Mapped[str | None] = mapped_column(
        Text,
        nullable=True
    )

    created_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True
    )

    started_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True
    )

    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True
    )
from app.db import SessionLocal
from app.judge_submission_entity import (
    JudgeSubmissionEntity
)


class JudgeSubmissionRepository:

    def save(
        self,
        entity
    ):
        db = SessionLocal()

        try:
            db.add(entity)
            db.commit()

        finally:
            db.close()

    def get(
        self,
        submission_id
    ):
        db = SessionLocal()

        try:
            return (
                db.query(
                    JudgeSubmissionEntity
                )
                .filter(
                    JudgeSubmissionEntity.id
                    == submission_id
                )
                .first()
            )

        finally:
            db.close()

    def update(
        self,
        entity
    ):
        db = SessionLocal()

        try:
            db.merge(entity)
            db.commit()

        finally:
            db.close()
from uuid import uuid4

from app.models import JudgeSubmission
from app.submission_status import SubmissionStatus
from app.judge_submission_store import JUDGE_SUBMISSIONS
from datetime import datetime,UTC
from app.judge_submission_entity import (JudgeSubmissionEntity)
from app.repositories.judge_submission_repository import (
    JudgeSubmissionRepository
)

repository = (
    JudgeSubmissionRepository()
)


class JudgeSubmissionService:

    def create(
        self,
        language,
        code,
        test_cases,
        stop_on_failure
    ):
        submission = JudgeSubmission(
            id=str(uuid4()),
            language=language,
            code=code,
            test_cases=test_cases,
            stop_on_failure=stop_on_failure,
        )
        entity = JudgeSubmissionEntity(
            id=submission.id,
            language=submission.language,
            code=submission.code,
            status=submission.status.value,
            stop_on_failure=submission.stop_on_failure,
            created_at=submission.created_at
        )

        repository.save(entity)
        JUDGE_SUBMISSIONS[submission.id] = submission

        print(
            f"[CREATE] Stored submission "
            f"{submission.id}"
        )

        return submission

    def get(
        self,
        submission_id
    ):
        submission = JUDGE_SUBMISSIONS.get(
            submission_id
        )

        print(
            f"[GET] {submission_id} -> "
            f"{submission is not None}"
        )

        return submission

    def mark_running(
        self,
        submission_id
    ):
        submission = JUDGE_SUBMISSIONS[
            submission_id
        ]

        submission.status = (
            SubmissionStatus.RUNNING
        )
        submission.started_at = datetime.now(UTC)
        entity = repository.get(submission_id)

        entity.status = (
            SubmissionStatus.RUNNING.value
        )

        entity.started_at = (
            submission.started_at
        )

        repository.update(entity)

        return submission
    def mark_completed(
        self,
        submission_id,
        result
    ):
        submission = JUDGE_SUBMISSIONS[
            submission_id
        ]

        submission.status = (
            SubmissionStatus.COMPLETED
        )

        submission.completed_at = datetime.now(UTC)

        submission.result = result
        entity = repository.get(
            submission_id
        )

        entity.status = (
            SubmissionStatus.COMPLETED.value
        )

        entity.completed_at = (
            submission.completed_at
        )

        entity.result_json = (
            submission.result.model_dump_json()
        )

        repository.update(entity)



        return submission

    def mark_failed(
        self,
        submission_id,
        error
    ):
        submission = JUDGE_SUBMISSIONS[
            submission_id
        ]

        submission.status = (
            SubmissionStatus.FAILED
        )

        submission.stderr = str(error)

        print(
            f"[FAILED] {submission_id}"
        )
        print(error)
        entity=repository.get(
            submission_id
        )
        entity.status = (
            SubmissionStatus.FAILED.value
        )

        repository.update(entity)

        return submission
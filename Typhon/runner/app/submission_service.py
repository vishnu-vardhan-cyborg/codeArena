from uuid import uuid4

from app.models import Submission
from app.submission_status import SubmissionStatus
from app.submission_store import SUBMISSIONS


class SubmissionService:

    def create(
        self,
        language,
        code,
        stdin
    ):

        submission = Submission(
            id=str(uuid4()),
            language=language,
            code=code,
            stdin=stdin,
            status=SubmissionStatus.QUEUED
        )

        SUBMISSIONS[submission.id] = submission

        return submission

    def get(
        self,
        submission_id
    ):

        return SUBMISSIONS.get(
            submission_id
        )

    def mark_running(
        self,
        submission_id
    ):

        submission = SUBMISSIONS[
            submission_id
        ]

        submission.status = (
            SubmissionStatus.RUNNING
        )

        return submission

    def mark_completed(
        self,
        submission_id,
        result
    ):

        submission = SUBMISSIONS[
            submission_id
        ]

        submission.status = (
            SubmissionStatus.COMPLETED
        )

        submission.stdout = result.stdout

        submission.stderr = result.stderr

        submission.exit_code = (
            result.exit_code
        )

        submission.timed_out = (
            result.timed_out
        )

        submission.elapsed_time_ms = (
            result.elapsed_time_ms
        )

        return submission

    def mark_failed(
        self,
        submission_id,
        error
    ):

        submission = SUBMISSIONS[
            submission_id
        ]

        submission.status = (
            SubmissionStatus.FAILED
        )

        submission.stderr = str(error)

        return submission

    def delete(
        self,
        submission_id
    ):

        return SUBMISSIONS.pop(
            submission_id,
            None
        )

    def list_all(
        self
    ):

        return list(
            SUBMISSIONS.values()
        )
from app.queue_manager import submission_queue
from app.submission_service import SubmissionService
from app.executor import Executor

submission_service = SubmissionService()
executor = Executor()


def start_worker():

    while True:

        submission_id = submission_queue.get()

        try:

            submission = submission_service.get(
                submission_id
            )

            if not submission:
                continue

            submission_service.mark_running(
                submission_id
            )

            result = executor.execute(
                language=submission.language,
                code=submission.code,
                stdin=submission.stdin
            )

            submission_service.mark_completed(
                submission_id,
                result
            )

        except Exception as e:

            submission_service.mark_failed(
                submission_id,
                str(e)
            )

        finally:

            submission_queue.task_done()
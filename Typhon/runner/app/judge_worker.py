from app.judge_queue_manager import judge_queue
from app.judge_submission_service import (
    JudgeSubmissionService
)
from app.judge_service import JudgeService


judge_submission_service = (
    JudgeSubmissionService()
)

judge_service = JudgeService()


def start_judge_worker():

    while True:

        print(
            "[WORKER] Waiting for job..."
        )

        submission_id = (
            judge_queue.get()
        )

        print(
            f"[WORKER] Got job: "
            f"{submission_id}"
        )

        try:

            submission = (
                judge_submission_service.get(
                    submission_id
                )
            )


            if not submission:

                print(
                    "[WORKER] Submission not found"
                )

                continue

            judge_submission_service.mark_running(
                submission_id
            )

            print(
                "[WORKER] Calling judge..."
            )

            result = judge_service.judge(
                language=submission.language,
                code=submission.code,
                test_cases=submission.test_cases,
                stop_on_failure=(
                    submission.stop_on_failure
                )
            )

            print(
                "[WORKER] Judge returned:"
            )
            print(result)

            judge_submission_service.mark_completed(
                submission_id,
                result
            )

        except Exception as e:

            print(
                "[WORKER ERROR]"
            )

            print(
                repr(e)
            )

            judge_submission_service.mark_failed(
                submission_id,
                str(e)
            )

        finally:

            judge_queue.task_done()

            print(
                "[WORKER] Done"
            )
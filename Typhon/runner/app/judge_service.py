import time

from app.executor import Executor
from app.models import (
    JudgeResult,
    TestCaseResult
)
from app.verdict import Verdict
from app.languages.registry import LANGUAGES
from app.languages.container_runner import ContainerRunner
from app.models import TestCase


class JudgeService:

    def __init__(self):

        self.executor = Executor()

    def judge(
        self,
        language: str,
        code: str,
        test_cases,
        stop_on_failure=False
    ):

        results = []

        passed_count = 0

        judge_start = time.perf_counter()
        config = LANGUAGES.get(language)

        runner = ContainerRunner(config)

        runner.start(code)
        try:
            for index, test_case in enumerate(test_cases):

                testcase_start = time.perf_counter()
                execution = runner.execute(stdin=test_case.input)
                print(execution)
                testcase_elapsed = (
                    time.perf_counter() - testcase_start
                ) * 1000

                actual_output = (
                    execution.stdout.strip()
                )

                expected_output = (
                    test_case.expected_output.strip()
                )

                if execution.timed_out:

                    verdict = Verdict.TIME_LIMIT_EXCEEDED

                elif execution.exit_code != 0:

                    verdict = Verdict.RUNTIME_ERROR

                elif actual_output == expected_output:

                    verdict = Verdict.ACCEPTED

                else:

                    verdict = Verdict.WRONG_ANSWER

                passed = (
                    verdict == Verdict.ACCEPTED
                )

                actual_to_return = actual_output
                expected_to_return = expected_output

                if passed:
                    passed_count += 1
                if test_case.hidden:

                    actual_to_return = None
                    expected_to_return = None

                results.append(

                    TestCaseResult(
                        testcase_number=index + 1,
                        verdict=verdict,
                        execution_time_ms=round(
                            testcase_elapsed,
                            2
                        ),
                        passed=passed,
                        hidden=test_case.hidden,
                        actual_output=actual_to_return,
                        expected_output=expected_to_return,
                        stderr=execution.stderr
                    )

                )
                if not passed and stop_on_failure:
                    break

            overall_verdict = Verdict.ACCEPTED

            for result in results:

                if result.verdict != Verdict.ACCEPTED:

                    overall_verdict = result.verdict

                    break
        finally:
            runner.cleanup()
        judge_elapsed = (
            time.perf_counter() - judge_start
        ) * 1000

        return JudgeResult(

            verdict=overall_verdict,

            total=len(results),

            passed=passed_count,

            failed=len(results) - passed_count,

            execution_time_ms=round(
                judge_elapsed,
                2
            ),

            results=results
        )
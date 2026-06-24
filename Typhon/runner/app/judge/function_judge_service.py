import json
import time

from app.languages.registry import LANGUAGES
from app.languages.container_runner import ContainerRunner

from app.models import (
    JudgeResult,
    TestCaseResult
)

from app.verdict import Verdict
from app.judge.java_build_runner import JavaBuildRunner
from app.judge.python_build_runner import PythonBuildRunner


class FunctionJudgeService:

    def judge(
        self,
        language: str,
        code: str,
        function_name: str,
        test_cases,
        stop_on_failure=False
    ):

        self.python_build_runner = PythonBuildRunner().build
        self.java_build_runner = JavaBuildRunner().build

        builders = {
            "python": self.python_build_runner,
            "java": self.java_build_runner
        }

        builder = builders.get(language)

        if not builder:
            raise ValueError(
                f"Unsupported language: {language}"
            )

        runner_code = builder(
            code,
            function_name,
            test_cases
        )

        config = LANGUAGES[language]

        runner = ContainerRunner(config)

        judge_start = time.perf_counter()

        try:

            runner.start(runner_code)

            execution = runner.execute()

        except RuntimeError as e:

            return JudgeResult(
                verdict=Verdict.COMPILATION_ERROR,
                total=len(test_cases),
                passed=0,
                failed=len(test_cases),
                execution_time_ms=0,
                results=[],
                stderr=str(e)
            )

        finally:

            runner.cleanup()

        judge_elapsed = (
            time.perf_counter() - judge_start
        ) * 1000
        print(execution)
        if execution.timed_out:

            return JudgeResult(
                verdict=Verdict.TIME_LIMIT_EXCEEDED,
                total=len(test_cases),
                passed=0,
                failed=len(test_cases),
                execution_time_ms=round(
                    judge_elapsed,
                    2
                ),
                results=[]
            )

        if execution.exit_code != 0:
            print("Lohith")
            
            return JudgeResult(
                verdict=Verdict.RUNTIME_ERROR,
                stderr=execution.stderr,
                total=len(test_cases),
                passed=0,
                failed=len(test_cases),
                execution_time_ms=round(
                    judge_elapsed,
                    2
                ),
                results=[]
            )
        

        # print("RAW OUTPUT:")

        stdout = (
            execution.stdout or ""
        ).strip()

        if not stdout:

            return JudgeResult(
                verdict=Verdict.RUNTIME_ERROR,
                stderr="No output produced by runner",
                total=len(test_cases),
                passed=0,
                failed=len(test_cases),
                execution_time_ms=round(
                    judge_elapsed,
                    2
                ),
                results=[]
            )

        lines = stdout.splitlines()

        json_line = None
        # print(lines)

        for line in reversed(lines):

            stripped = line.strip()

            if (
                stripped.startswith("[")
                or stripped.startswith("{")
            ):
                json_line = stripped
                break
            

        if json_line is None:
            return JudgeResult(
                verdict=Verdict.RUNTIME_ERROR,
                stderr=(
                    "Judge output JSON not found.\n\n"
                    f"stdout:\n{stdout}"
                ),
                total=len(test_cases),
                passed=0,
                failed=len(test_cases),
                execution_time_ms=round(
                    judge_elapsed,
                    2
                ),
                results=[]
            )

        try:

            raw_results = json.loads(
                json_line
            )

        except Exception as e:

            return JudgeResult(
                verdict=Verdict.RUNTIME_ERROR,
                stderr=(
                    f"Failed to parse judge JSON.\n\n"
                    f"JSON Line:\n{json_line}\n\n"
                    f"Error:\n{str(e)}"
                ),
                total=len(test_cases),
                passed=0,
                failed=len(test_cases),
                execution_time_ms=round(
                    judge_elapsed,
                    2
                ),
                results=[]
            )

        results = []

        passed_count = 0

        for index, (
            test_case,
            result
        ) in enumerate(
            zip(
                test_cases,
                raw_results
            )
        ):

            if not result["success"]:

                verdict = (
                    Verdict.RUNTIME_ERROR
                )

                actual = (
                    result.get("error")
                )

            else:

                actual = result["actual"]

                if (
                    actual
                    ==
                    test_case.expected_output
                ):

                    verdict = (
                        Verdict.ACCEPTED
                    )

                else:

                    verdict = (
                        Verdict.WRONG_ANSWER
                    )

            passed = (
                verdict
                ==
                Verdict.ACCEPTED
            )

            if passed:

                passed_count += 1

            actual_to_return = actual

            expected_to_return = (
                test_case.expected_output
            )

            if test_case.hidden:

                actual_to_return = None
                expected_to_return = None

            results.append(

                TestCaseResult(
                    testcase_number=index + 1,
                    verdict=verdict,
                    execution_time_ms=0,
                    passed=passed,
                    hidden=test_case.hidden,
                    stdout=result.get("stdout", "") or "",
                    stderr=result.get("stderr", "") or "",
                    actual_output=(
                        str(actual_to_return)
                        if actual_to_return
                        is not None
                        else None
                    ),
                    expected_output=(
                        str(expected_to_return)
                        if expected_to_return
                        is not None
                        else None
                    )
                )

            )

            if (
                not passed
                and stop_on_failure
            ):
                break

        overall_verdict = (
            Verdict.ACCEPTED
        )

        for result in results:

            if (
                result.verdict
                !=
                Verdict.ACCEPTED
            ):

                overall_verdict = (
                    result.verdict
                )

                break

        return JudgeResult(
            verdict=overall_verdict,
            total=len(results),
            passed=passed_count,
            failed=len(results)
            - passed_count,
            execution_time_ms=round(
                judge_elapsed,
                2
            ),
            results=results,
            stderr=""
        )
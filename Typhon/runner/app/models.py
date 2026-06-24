from pydantic import BaseModel
from uuid import uuid4
from pydantic import Field
from pydantic import BaseModel
from app.verdict import Verdict
from app.submission_status import SubmissionStatus
from datetime import datetime,UTC


class ExecuteRequest(BaseModel):
    language: str = "python"
    code: str
    stdin: str = ""


class ExecutionResult(BaseModel):
    stdout: str
    stderr: str
    exit_code: int
    timed_out: bool
    elapsed_time_ms: float

from dataclasses import dataclass


@dataclass
class DockerExecutionResult:
    stdout: str
    stderr: str
    returncode: int
    timed_out: bool

class ErrorResponse(BaseModel):
    error: str

class Submission(BaseModel):

    id: str

    language: str

    code: str

    stdin: str

    status: SubmissionStatus

    stdout: str = ""

    stderr: str = ""

    exit_code: int | None = None

    timed_out: bool = False

    elapsed_time_ms: float | None = None


class TestCase(BaseModel):

    input: str

    expected_output: str

    hidden: bool = False


class JudgeRequest(BaseModel):

    language: str

    code: str

    test_cases: list[TestCase]

    stop_on_failure: bool = False



class TestCaseResult(BaseModel):

    testcase_number: int

    verdict: Verdict

    execution_time_ms: float

    passed: bool

    hidden: bool

    actual_output: str | None = None

    expected_output: str | None = None

    stdout: str = ""

    stderr: str = ""

class JudgeResult(BaseModel):

    verdict: Verdict

    total: int

    passed: int

    failed: int

    execution_time_ms: float

    results: list[TestCaseResult]

    stderr: str = ""


class JudgeSubmission(BaseModel):

    id: str

    language: str

    code: str

    test_cases: list[TestCase]

    stop_on_failure: bool = False

    status: SubmissionStatus = SubmissionStatus.QUEUED

    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    started_at: datetime | None = None

    completed_at: datetime | None = None

    result: JudgeResult | None = None

    stderr: str = ""


class FunctionTestCase(BaseModel):
    args: list
    expected_output: object
    hidden: bool = False
    arg_types: list[str] | None = None

class FunctionJudgeRequest(BaseModel):
    language: str
    code: str
    function_name: str
    test_cases: list[FunctionTestCase]
    stop_on_failure: bool = False
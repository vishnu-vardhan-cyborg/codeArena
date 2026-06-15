from pydantic import BaseModel

from app.submission_status import SubmissionStatus


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

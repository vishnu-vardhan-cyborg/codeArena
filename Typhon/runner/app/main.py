from fastapi import FastAPI
from app.models import (
    ExecuteRequest,
    ExecutionResult
)
from app.submission_service import SubmissionService
from app.judge_submission_service import JudgeSubmissionService
from app.queue_manager import submission_queue
from contextlib import asynccontextmanager
import threading
from app.worker import start_worker
from app.judge_worker import start_judge_worker
from app.db import engine, Base
from app.languages.registry import LANGUAGES
from app.models import (
    JudgeRequest,FunctionJudgeRequest
)
from app.judge_submission_entity import (
    JudgeSubmissionEntity
)
from app.judge.function_judge_service import (
    FunctionJudgeService
)
from app.judge_queue_manager import judge_queue

from app.executor import Executor

from app.judge_service import JudgeService
from fastapi.middleware.cors import CORSMiddleware

judge_service = JudgeService()

judge_functional_service = FunctionJudgeService()



@asynccontextmanager
async def lifespan(app):
    Base.metadata.create_all(bind=engine)

    worker_thread = threading.Thread(
        target=start_worker,
        daemon=True
    )
    judge_worker_thread = threading.Thread(
        target=start_judge_worker,
        daemon=True
    )

    worker_thread.start()
    judge_worker_thread.start()
    yield


app = FastAPI(
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

executor = Executor()
submission_service = SubmissionService()
judge_submission_service = JudgeSubmissionService()


@app.get("/")
def read_root():
    return {
        "message": "Welcome to the Code Runner API. Visit /docs for API documentation."
    }
@app.post(
    "/execute",
    response_model=ExecutionResult
)
def execute(req: ExecuteRequest):

    return executor.execute(
        language=req.language,
        code=req.code,
        stdin=req.stdin
    )


@app.post("/submissions")
def create_submission(request: ExecuteRequest):

    submission = submission_service.create(
        language=request.language,
        code=request.code,
        stdin=request.stdin
    )

    submission_queue.put(
        submission.id
    )
    print(submission_queue.qsize())

    return {
        "id": submission.id,
        "status": submission.status
    }
@app.get("/submissions/{submission_id}")
def get_submission(
    submission_id: str
):

    submission = (
        submission_service.get(
            submission_id
        )
    )

    if not submission:

        raise HTTPException(
            status_code=404,
            detail="Submission not found"
        )

    return submission

@app.get("/languages")
def get_languages():

    return list(LANGUAGES.keys())


@app.post("/judge")
def judge(
    request: JudgeRequest
):

    return judge_service.judge(
        language=request.language,
        code=request.code,
        test_cases=request.test_cases,
        stop_on_failure=True
    )

@app.post("/judge-submissions")
def create_judge_submission(
    request: JudgeRequest
):

    submission = (
        judge_submission_service.create(
            language=request.language,
            code=request.code,
            test_cases=request.test_cases,
            stop_on_failure=True
        )
    )

    print(
        f"[API] Created "
        f"{submission.id}"
    )

    judge_queue.put(
        submission.id
    )

    print(
        f"[API] Queue size "
        f"{judge_queue.qsize()}"
    )

    return submission

@app.get(
    "/judge-submissions/{submission_id}"
)
def get_judge_submission(
    submission_id: str
):

    return (
        judge_submission_service.get(
            submission_id
        )
    )

@app.post("/judge/function")
def judge_function(
    request: FunctionJudgeRequest
):

    return judge_functional_service.judge(
        language=request.language,
        code=request.code,
        function_name=(
            request.function_name
        ),
        test_cases=(
            request.test_cases
        ),
        stop_on_failure=(
            request.stop_on_failure
        )
    )
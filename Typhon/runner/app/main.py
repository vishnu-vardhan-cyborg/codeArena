from fastapi import FastAPI, HTTPException
from app.models import (
    ExecuteRequest,
    ExecutionResult
)
from app.submission_service import SubmissionService
from app.queue_manager import submission_queue
from contextlib import asynccontextmanager
import threading
from app.worker import start_worker
from app.languages.registry import LANGUAGES


from app.executor import Executor


@asynccontextmanager
async def lifespan(app):

    worker_thread = threading.Thread(
        target=start_worker,
        daemon=True
    )

    worker_thread.start()

    yield


app = FastAPI(
    lifespan=lifespan
)

executor = Executor()
submission_service = SubmissionService()


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

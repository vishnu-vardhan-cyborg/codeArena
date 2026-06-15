import os
import tempfile
import time

from app.executors.docker_executor import DockerExecutor
from app.models import ExecutionResult


class ContainerRunner:

    def __init__(self, config):

        self.config = config

        self.executor = DockerExecutor()

    def execute(self, code: str, stdin: str = ""):

        with tempfile.NamedTemporaryFile(
            mode="w",
            suffix=self.config.file_extension,
            delete=False
        ) as file:

            file.write(code)

            file_path = os.path.abspath(file.name)

        start = time.perf_counter()

        try:

            result = self.executor.run(
                image=self.config.image,
                source_path=file_path,
                command_to_run=self.config.run_command,
                container_path=self.config.container_path,
                stdin=stdin
            )

            elapsed = (
                time.perf_counter() - start
            ) * 1000

            if result is None:

                return ExecutionResult(
                    stdout="",
                    stderr="Execution timed out",
                    exit_code=-1,
                    timed_out=True,
                    elapsed_time_ms=round(elapsed, 2)
                )

            return ExecutionResult(
                stdout=result.stdout,
                stderr=result.stderr,
                exit_code=result.returncode,
                timed_out=False,
                elapsed_time_ms=round(elapsed, 2)
            )

        finally:

            if os.path.exists(file_path):
                os.remove(file_path)
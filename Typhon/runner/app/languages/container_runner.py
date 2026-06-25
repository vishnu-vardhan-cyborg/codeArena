import os
import tempfile
import time

from app.executors.docker_executor import DockerExecutor
from app.models import ExecutionResult


class ContainerRunner:

    def __init__(self, config):

        self.config = config

        self.executor = DockerExecutor()

        self.container_id = None

        self.file_path = None

    def start(
        self,
        code: str
    ):

        with tempfile.NamedTemporaryFile(
            mode="w",
            suffix=self.config.file_extension,
            delete=False
        ) as file:

            file.write(code)

            self.file_path = os.path.abspath(
                file.name
            )

        self.container_id = (
            self.executor.create_container(
                image=self.config.image,
                source_path=self.file_path,
                container_path=self.config.container_path
            )
        )

        if self.config.compile_command:

            compile_result = (
                self.executor.exec(
                    container_id=self.container_id,
                    command_to_run=self.config.compile_command
                )
            )

            if compile_result is None:

                raise RuntimeError(
                    "Compilation timed out"
                )

            if compile_result.returncode != 0:

                raise RuntimeError(
                    compile_result.stderr
                )

    def execute(
        self,
        stdin: str = ""
    ):

        start = time.perf_counter()

        result = self.executor.exec(
            container_id=self.container_id,
            command_to_run=self.config.run_command,
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
                elapsed_time_ms=round(
                    elapsed,
                    2
                )
            )

        return ExecutionResult(
            stdout=result.stdout,
            stderr=result.stderr,
            exit_code=result.returncode,
            timed_out=False,
            elapsed_time_ms=round(
                elapsed,
                2
            )
        )

    def cleanup(self):

        if self.container_id:

            self.executor.destroy_container(
                self.container_id
            )

        if (
            self.file_path
            and os.path.exists(
                self.file_path
            )
        ):

            os.remove(
                self.file_path
            )
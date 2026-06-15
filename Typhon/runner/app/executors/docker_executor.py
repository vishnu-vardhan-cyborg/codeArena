import subprocess


class DockerExecutor:

    def run(
        self,
        image: str,
        source_path: str,
        container_path: str,
        command_to_run: list[str],
        stdin: str = "",
        timeout_seconds: int = 5
    ):

        command = [
            "docker",
            "run",
            "--rm",
            "--network", "none",
            "--memory", "128m",
            "--cpus", "1",
            "--pids-limit", "64",
            "-i",
            "-v",
            f"{source_path}:{container_path}:ro",
            image,
            *command_to_run
        ]

        try:

            return subprocess.run(
                command,
                input=stdin,
                capture_output=True,
                text=True,
                timeout=timeout_seconds
            )

        except subprocess.TimeoutExpired:

            return None
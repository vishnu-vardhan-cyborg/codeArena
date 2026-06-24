import subprocess


class DockerExecutor:

    def create_container(
        self,
        image: str,
        source_path: str,
        container_path: str
    ):

        command = [
            "docker",
            "run",
            "-d",
            "--network", "none",
            "--memory", "256m",
            "--cpus", "1",
            "--pids-limit", "64",
            "-v",
            f"{source_path}:{container_path}",
            image,
            "tail",
            "-f",
            "/dev/null"
        ]

        result = subprocess.run(
            command,
            capture_output=True,
            text=True
        )

        return result.stdout.strip()

    def exec(
        self,
        container_id: str,
        command_to_run: list[str],
        stdin: str = "",
        timeout_seconds: int = 5
    ):

        command = [
            "docker",
            "exec",
            "-i",
            container_id,
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

    def destroy_container(
        self,
        container_id: str
    ):

        subprocess.run(
            [
                "docker",
                "rm",
                "-f",
                container_id
            ],
            capture_output=True
        )
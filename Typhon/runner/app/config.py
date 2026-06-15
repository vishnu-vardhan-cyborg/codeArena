from dataclasses import dataclass


@dataclass(frozen=True)
class ExecutionConfig:
    timeout_seconds: int = 100
    max_output_size: int = 10000
    temp_dir: str = "/tmp/typhon"


CONFIG = ExecutionConfig()
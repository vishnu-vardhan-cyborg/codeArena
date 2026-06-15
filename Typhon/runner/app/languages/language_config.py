from dataclasses import dataclass


@dataclass
class LanguageConfig:

    name: str

    file_extension: str

    image: str

    run_command: list[str]

    compile_command: list[str] | None = None
    container_path: str = "/sandbox/code"
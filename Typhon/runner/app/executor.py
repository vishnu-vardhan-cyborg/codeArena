from fastapi import HTTPException

from app.languages.registry import LANGUAGES
from app.languages.container_runner import ContainerRunner


class Executor:

    def execute(
        self,
        language: str,
        code: str,
        stdin: str = ""
    ):

        config = LANGUAGES.get(language)

        if not config:

            raise HTTPException(
                status_code=400,
                detail=f"Unsupported language: {language}"
            )

        runner = ContainerRunner(config)

        return runner.execute(
            code=code,
            stdin=stdin
        )
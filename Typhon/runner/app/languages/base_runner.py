from abc import ABC, abstractmethod

from app.models import ExecutionResult


class BaseRunner(ABC):

    @abstractmethod
    def execute(
        self,
        code: str,
        stdin: str = ""
    ) -> ExecutionResult:
        pass
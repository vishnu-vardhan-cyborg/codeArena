import json
from pathlib import Path
import re


class JavaBuildRunner:

    TEMPLATE_PATH = (
        Path(__file__).resolve().parent
        / "templates"
        / "Java.txt"
    )

    @staticmethod
    def build(
        code,
        function_name,
        test_cases
    ):


        solution_code = re.sub(
            r"public\s+class\s+Solution",
            "class Solution",
            code
        )

        test_data = [
            {
                "args": tc.args,
                **(
                    {"argTypes": tc.arg_types}
                    if getattr(tc, "arg_types", None)
                    else {}
                )
            }
            for tc in test_cases
        ]


        test_data_json_literal = json.dumps(
            json.dumps(test_data)
        )

        template = JavaBuildRunner.TEMPLATE_PATH.read_text()
        return (
            template
            .replace("{{SOLUTION_CODE}}", solution_code)
            .replace("{{FUNCTION_NAME}}", function_name)
            .replace("{{TEST_DATA_JSON}}", test_data_json_literal)
        )
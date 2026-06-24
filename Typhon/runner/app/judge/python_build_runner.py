import json


class PythonBuildRunner:

    def build(
        self,
        code,
        function_name,
        test_cases
    ):

        test_data = [
            {
                "args": tc.args
            }
            for tc in test_cases
        ]

        return f'''
import json
import io
import contextlib

{code}

tests = json.loads(
    {json.dumps(json.dumps(test_data))}
)

results = []

# Resolve callable
try:

    if "Solution" in globals():

        solution = Solution()

        callable_fn = getattr(
            solution,
            "{function_name}"
        )

    else:

        callable_fn = globals()[
            "{function_name}"
        ]

except Exception as e:

    print(
        json.dumps([
            {{
                "success": False,
                "error": str(e)
            }}
            for _ in tests
        ])
    )

    raise SystemExit()

for test in tests:

    stdout_buffer = io.StringIO()
    stderr_buffer = io.StringIO()

    try:

        with contextlib.redirect_stdout(stdout_buffer), \\
             contextlib.redirect_stderr(stderr_buffer):

            actual = callable_fn(
                *test["args"]
            )

        results.append(
            {{
                "success": True,
                "actual": actual,
                "stdout": stdout_buffer.getvalue(),
                "stderr": stderr_buffer.getvalue()
            }}
        )

    except Exception as e:

        results.append(
            {{
                "success": False,
                "error": str(e),
                "stdout": stdout_buffer.getvalue(),
                "stderr": stderr_buffer.getvalue()
            }}
        )

print(
    json.dumps(results)
)
'''
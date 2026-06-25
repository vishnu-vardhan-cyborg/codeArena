import requests
import time

URL = "http://localhost:8000/judge/function"

for count in [1, 10, 100, 1000]:

    payload = {
        "language": "python",
        "function_name": "square",
        "code": """
def square(n):
    return n*n
""",
        "test_cases": [
            {
                "args": [i],
                "expected_output": i*i
            }
            for i in range(count)
        ]
    }

    start = time.time()

    response = requests.post(
        URL,
        json=payload,
        timeout=120
    )

    elapsed = time.time() - start

    print(
        f"{count:5d} cases | "
        f"{elapsed:.2f}s | "
        f"{response.json()['verdict']}"
    )
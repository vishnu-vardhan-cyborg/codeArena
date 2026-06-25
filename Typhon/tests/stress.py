import requests
import time

URL = "http://localhost:8000/judge/function"

payload = {
    "language": "python",
    "function_name": "square",
    "code": """
def square(n):
    return n * n
""",
    "test_cases": [
        {
            "args": [i],
            "expected_output": i * i
        }
        for i in range(1000)
    ]
}

start = time.time()

response = requests.post(
    URL,
    json=payload,
    timeout=60
)

elapsed = time.time() - start

print("HTTP:", response.status_code)
print("Elapsed:", round(elapsed, 2), "sec")

data = response.json()

print("Verdict:", data["verdict"])
print("Passed:", data["passed"])
print("Failed:", data["failed"])
print("Execution:", data["execution_time_ms"], "ms")
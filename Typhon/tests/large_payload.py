import requests
import time

URL = "http://localhost:8000/judge/function"

nums = list(range(10000))

payload = {
    "language": "python",
    "function_name": "sum_nums",
    "code": """
def sum_nums(nums):
    return sum(nums)
""",
    "test_cases": [
        {
            "args": [nums],
            "expected_output": sum(nums)
        }
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
print("Time:", round(elapsed, 2), "sec")
print(response.json()["verdict"])
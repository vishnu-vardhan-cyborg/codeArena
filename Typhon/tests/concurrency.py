import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
import time

URL = "http://localhost:8000/judge/function"

BODY = {
    "language": "python",
    "function_name": "square",
    "code": """
def square(n):
    return n*n
""",
    "test_cases": [
        {
            "args": [5],
            "expected_output": 25
        }
    ]
}


def submit():
    response = requests.post(
        URL,
        json=BODY,
        timeout=30
    )

    return response.status_code


TOTAL_REQUESTS = 200
WORKERS = 100

start = time.time()

success = 0
failed = 0

with ThreadPoolExecutor(max_workers=WORKERS) as executor:

    futures = [
        executor.submit(submit)
        for _ in range(TOTAL_REQUESTS)
    ]

    for future in as_completed(futures):

        try:

            status = future.result()

            if status == 200:
                success += 1
            else:
                failed += 1

        except Exception:
            failed += 1

elapsed = time.time() - start

print()
print("Requests :", TOTAL_REQUESTS)
print("Workers  :", WORKERS)
print("Success  :", success)
print("Failed   :", failed)
print("Time     :", round(elapsed, 2), "sec")
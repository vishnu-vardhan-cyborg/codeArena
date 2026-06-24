import requests
import json

URL = "http://localhost:8000/judge/function"

payload = {
    "language": "python",
    "function_name": "solve",
    "code": """
def solve():
    x = []

    while True:
        x.append(
            "A" * 1000000
        )
""",
    "test_cases": [
        {
            "args": [],
            "expected_output": 0
        }
    ]
}

response = requests.post(
    URL,
    json=payload,
    timeout=30
)

print(json.dumps(
    response.json(),
    indent=2
))
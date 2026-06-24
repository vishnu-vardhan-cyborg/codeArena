import requests
import json

URL = "http://localhost:8000/judge/function"

payload = {
    "language": "python",
    "function_name": "solve",
    "code": """
def solve():
    while True:
        pass
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
    timeout=20
)

print(json.dumps(
    response.json(),
    indent=2
))
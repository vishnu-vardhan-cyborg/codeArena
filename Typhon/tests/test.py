import requests
import json

URL = "http://localhost:8000/judge/function"

# Each test optionally carries "expected_verdict" (default "ACCEPTED").
# For negative tests we just assert the verdict is NOT "ACCEPTED" unless
# an exact string is known - see notes in the chat response.
NOT_ACCEPTED = "__NOT_ACCEPTED__"

tests = []


tests.append({
    "name": "java/TreeNode",
    "body": {
        "language": "java",
        "function_name": "inorder",
        "code": """
import java.util.*;

class Solution {

    public static class TreeNode {
        int val;
        TreeNode left;
        TreeNode right;
        TreeNode() {}
        TreeNode(int val) { this.val = val; }
        TreeNode(int val, TreeNode left, TreeNode right) {
            this.val = val;
            this.left = left;
            this.right = right;
        }
    }

    public List<Integer> inorder(TreeNode root) {
        List<Integer> result = new ArrayList<>();
        inorderHelper(root, result);
        return result;
    }

    private void inorderHelper(TreeNode node, List<Integer> result) {
        if (node == null) {
            return;
        }
        inorderHelper(node.left, result);
        result.add(node.val);
        inorderHelper(node.right, result);
    }
}
""",
        "test_cases": [
            {"args": [[1, None, 2, 3]], "expected_output": [1, 3, 2]}
        ]
    }
})

# =====================================================================
# Runner
# =====================================================================

passed = 0
failed_names = []

for test in tests:

    print(f"\nRunning: {test['name']}")

    try:
        response = requests.post(URL, json=test["body"], timeout=15)
    except requests.exceptions.RequestException as e:
        print(f"FAILED REQUEST: {e}")
        failed_names.append(test["name"])
        continue

    if response.status_code != 200:
        print(f"FAILED HTTP {response.status_code}")
        print(response.text)
        failed_names.append(test["name"])
        continue

    data = response.json()
    expected_verdict = test.get("expected_verdict", "ACCEPTED")
    actual_verdict = data.get("verdict")

    if expected_verdict == NOT_ACCEPTED:
        ok = actual_verdict != "ACCEPTED"
    else:
        ok = actual_verdict == expected_verdict

    if ok:
        print(f"PASS ({actual_verdict})")
        passed += 1
    else:
        print("FAIL")
        print(json.dumps(data, indent=2))
        failed_names.append(test["name"])

print(f"\nPassed {passed}/{len(tests)}")

if failed_names:
    print("\nFailed tests:")
    for name in failed_names:
        print(f"  - {name}")
# ⚡ Typhon

<p align="center">
  <b>Fast. Isolated. Function-First.</b>
</p>

<p align="center">
  A lightweight Docker-powered judging engine for coding platforms, assessments, interview systems, and online judges.
</p>

---

## 🚀 What is Typhon?

Typhon is a function judging engine that executes user submissions inside isolated Docker sandboxes and evaluates them against visible and hidden test cases.

Unlike traditional code execution APIs that expect complete programs, Typhon focuses on **function-based evaluation**.

Users submit:

* A function
* Test cases
* Expected outputs

Typhon handles:

* Runner generation
* Sandbox execution
* Output validation
* Error handling
* Verdict generation

```text
User Function
      │
      ▼
Language Builder
      │
      ▼
Generated Runner
      │
      ▼
Docker Sandbox
      │
      ▼
JSON Results
      │
      ▼
Verdicts
```

---

## ✨ Features

* 🚀 Function-level judging
* 🐳 Docker sandbox execution
* ☕ Java support
* 🐍 Python support
* 🔒 Hidden test cases
* 📄 Stdout capture
* ⚠️ Stderr capture
* ❌ Compilation error detection
* 💥 Runtime error detection
* ⏱️ Time limit enforcement
* 🛑 Stop-on-failure mode
* 📊 Detailed per-test verdicts
* 📦 Structured JSON responses
* ⚡ Single sandbox execution for all test cases

---

## 🎯 Why Typhon?

Most execution engines work like this:

```text
100 Test Cases
      │
      ├── Execution #1
      ├── Execution #2
      ├── Execution #3
      └── ...
```

Every execution starts a runtime again.

Typhon instead generates a runner and executes everything in a single sandbox:

```text
100 Test Cases
      │
      ▼
Generated Runner
      │
      ▼
Single Sandbox
      │
      ▼
JSON Results
```

This significantly reduces runtime startup overhead.

---

# 🌍 Supported Languages

| Language | Status     |
| -------- | ---------- |
| Java     | ✅          |
| Python   | ✅          |
| C++      | 🚧 Planned |

---

# 🏗 Architecture

```text
┌─────────────────────┐
│ User Submission     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Language Builder    │
│ (Java / Python)     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Generated Runner    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Docker Sandbox      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ JSON Results        │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Judge Verdict       │
└─────────────────────┘
```

---

# 🔐 Sandbox Security

Every submission runs inside an isolated Docker container.

Current container limits:

| Resource  | Limit     |
| --------- | --------- |
| Network   | Disabled  |
| Memory    | 256 MB    |
| CPU       | 1 Core    |
| Processes | 64        |
| Timeout   | 5 Seconds |

Container configuration:

```bash
docker run \
  -d \
  --network none \
  --memory 256m \
  --cpus 1 \
  --pids-limit 64
```

### Security Controls

#### 🚫 Network Isolation

```bash
--network none
```

Prevents:

* Internet access
* HTTP requests
* Socket connections
* Communication with other containers

---

#### 🧠 Memory Limits

```bash
--memory 256m
```

Protects against excessive memory usage and accidental OOM scenarios.

---

#### ⚙️ CPU Limits

```bash
--cpus 1
```

Restricts submissions to a single CPU core.

---

#### 🔄 Process Limits

```bash
--pids-limit 64
```

Mitigates:

* Fork bombs
* Excessive subprocess creation
* Process exhaustion attacks

---

#### ⏱ Execution Timeout

Submissions exceeding the configured timeout receive:

```json
{
  "verdict": "TIME_LIMIT_EXCEEDED"
}
```

---

# 🚀 Installation

## Requirements

* Python 3.11+
* Docker Desktop
* Git

Verify installation:

```bash
python --version
docker --version
git --version
```

---

## Clone Repository

```bash
git clone https://github.com/lohithreddym4/Typhon.git

cd Typhon/runner
```

---

## Create Virtual Environment

### Windows

```bash
python -m venv .venv

.venv\Scripts\activate
```

### Linux/macOS

```bash
python -m venv .venv

source .venv/bin/activate
```

---

## Install Dependencies

```bash
pip install -r requirements.txt
```

---

## Build Sandbox Images

```bash
python scripts/build_sandboxes.py
```

Verify:

```bash
docker images
```

Expected:

```text
typhon-python
typhon-java
```

---

## Run Typhon

```bash
uvicorn app.main:app --reload
```

Swagger UI:

```text
http://localhost:8000/docs
```

---

# 📡 API

## Function Judge

```http
POST /judge/function
```

---

## Example Request

### Java

```json
{
  "language": "java",
  "function_name": "maxProfit",
  "code": "class Solution { ... }",
  "test_cases": [
    {
      "args": [[7,1,5,3,6,4]],
      "expected_output": 5,
      "hidden": false,
      "arg_types": ["int[]"]
    }
  ],
  "stop_on_failure": false
}
```

### Python

```json
{
  "language": "python",
  "function_name": "maxProfit",
  "code": "class Solution: ...",
  "test_cases": [
    {
      "args": [[7,1,5,3,6,4]],
      "expected_output": 5,
      "hidden": false,
      "arg_types": ["int[]"]
    }
  ],
  "stop_on_failure": false
}
```

---

## Example Response

```json
{
  "verdict": "ACCEPTED",
  "total": 3,
  "passed": 3,
  "failed": 0,
  "execution_time_ms": 4825.47,
  "results": [
    {
      "testcase_number": 1,
      "verdict": "ACCEPTED",
      "passed": true,
      "hidden": false,
      "actual_output": "5",
      "expected_output": "5",
      "stdout": "L\n",
      "stderr": ""
    }
  ]
}
```

---

# 🏆 Verdicts

| Verdict             | Description                |
| ------------------- | -------------------------- |
| ACCEPTED            | All tests passed           |
| WRONG_ANSWER        | Output mismatch            |
| RUNTIME_ERROR       | Runtime exception occurred |
| COMPILATION_ERROR   | Compilation failed         |
| TIME_LIMIT_EXCEEDED | Execution timeout          |

---

# 🔒 Hidden Test Cases

Hidden tests execute normally but outputs remain private.

Request:

```json
{
  "hidden": true
}
```

Response:

```json
{
  "actual_output": null,
  "expected_output": null
}
```

Useful for:

* Online judges
* Coding assessments
* Interview platforms

---

# 📄 Stdout & Stderr Capture

User output is preserved.

Example:

```java
System.out.println("Hello");
```

Response:

```json
{
  "stdout": "Hello\n",
  "stderr": ""
}
```

Useful for debugging and learning environments.

---

# 🛑 Stop On Failure

Enable early termination:

```json
{
  "stop_on_failure": true
}
```

Typhon immediately stops after the first failed test case.

---

# ⚡ Performance

Typhon executes all test cases inside a **single generated runner** and **single sandbox execution**.

### Benchmark

Local machine:

```text
1 testcase      ≈ 3.2s
10 testcases    ≈ 3.2s
100 testcases   ≈ 3.2s
1000 testcases  ≈ 3.4s
```

Because the interpreter and container start only once, execution time remains nearly constant as test case counts increase.

### Execution Model

```text
Submission
      │
      ▼
Generate Runner
      │
      ▼
Create Sandbox
      │
      ▼
Execute All Tests
      │
      ▼
Collect Results
      │
      ▼
Destroy Sandbox
```

---

# 📜 License

MIT License

---

<p align="center">
Built with 🐍 Python • ☕ Java • 🐳 Docker
</p>

<p align="center">
Typhon — Fast, secure, function-first code evaluation.
</p>

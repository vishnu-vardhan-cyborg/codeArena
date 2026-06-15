# Typhon

A secure, container-based code execution engine built with FastAPI and Docker.

Typhon executes untrusted code inside isolated Docker containers with resource limits, submission lifecycle management, and multi-language support.

## Features

### Supported Languages

* Python 3
* Java 21

### Security

* Docker-based sandboxing
* Network isolation (`--network none`)
* Memory limits
* CPU limits
* PID limits
* Non-root execution
* Automatic container cleanup

### Execution Engine

* Submission Queue
* Background Worker
* Status Tracking
* Execution Time Measurement
* Standard Input (stdin) Support

---

# Architecture

```text
Client
  │
  ▼
POST /submissions
  │
  ▼
Submission Service
  │
  ▼
Queue
  │
  ▼
Worker
  │
  ▼
Executor
  │
  ▼
Language Runner
  │
  ▼
Docker Sandbox
```

Submission lifecycle:

```text
QUEUED
   ↓
RUNNING
   ↓
COMPLETED
```

or

```text
QUEUED
   ↓
RUNNING
   ↓
FAILED
```

---

# Requirements

Install:

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

# Clone Repository

```bash
git clone https://github.com/lohithreddym4/Typhon.git

cd Typhon/runner
```

---

# Create Virtual Environment

Windows:

```bash
python -m venv .venv

.venv\Scripts\activate
```

Linux/macOS:

```bash
python -m venv .venv

source .venv/bin/activate
```

---

# Install Dependencies

```bash
pip install -r requirements.txt
```

---

# Build Sandbox Images

## Python

```bash
docker build -t typhon-python ./sandboxes/python
```

## Java

```bash
docker build -t typhon-java ./sandboxes/java
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

# Run Typhon

Start the FastAPI server:

```bash
uvicorn app.main:app --reload
```

API:

```text
http://localhost:8000
```

Swagger Documentation:

```text
http://localhost:8000/docs
```

---

# Create Submission

Endpoint:

```http
POST /submissions
```

Example:

```json
{
  "language": "python",
  "code": "print('Hello Typhon')"
}
```

Response:

```json
{
  "id": "f4d86f8e-9d7a-4f90-8f58-5f2c8b4b8d76",
  "status": "QUEUED"
}
```

---

# Check Submission Status

Endpoint:

```http
GET /submissions/{id}
```

Example Response:

```json
{
  "id": "f4d86f8e-9d7a-4f90-8f58-5f2c8b4b8d76",
  "language": "python",
  "code": "print('Hello Typhon')",
  "stdin": "",
  "status": "COMPLETED",
  "stdout": "Hello Typhon\n",
  "stderr": "",
  "exit_code": 0,
  "timed_out": false,
  "elapsed_time_ms": 734.21
}
```

---

# Python Example

Request:

```json
{
  "language": "python",
  "code": "name=input()\nprint(f'Hello {name}')",
  "stdin": "Lohith"
}
```

Output:

```text
Hello Lohith
```

---

# Java Example

Request:

```json
{
  "language": "java",
  "code": "import java.util.*; public class Main { public static void main(String[] args) { Scanner sc = new Scanner(System.in); System.out.println(\"Hello \" + sc.nextLine()); } }",
  "stdin": "Lohith"
}
```

Output:

```text
Hello Lohith
```

---

# Security Model

Each submission runs in its own isolated container.

Current Docker restrictions:

```text
--network none
--memory 128m
--cpus 1
--pids-limit 64
```

This protects against:

* Internet access
* Memory exhaustion attacks
* Infinite process spawning
* Long-running programs

---

# Current Version

Typhon v0.3.0

Capabilities:

* Multi-language execution
* Docker sandboxing
* Submission queue
* Background worker
* Status tracking
* Python support
* Java support

---

Built from frustration with Judge0.

Typhon's goal is simple:

**Execute anything. Contain everything.**

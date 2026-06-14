# Local Judge0 CE

This project uses a self-hosted Judge0 CE instance for code execution.

## Start

```powershell
npm run judge0:setup
npm run judge0:up
```

Judge0 will be available at:

- API: `http://localhost:2358`
- Docs: `http://localhost:2358/docs`

Then start the CodeArena backend and frontend:

```powershell
npm run start:socket
npm start
```

The CodeArena backend proxies Judge0 through:

- `GET http://localhost:4000/api/judge0/languages`
- `POST http://localhost:4000/api/judge0/run`

## Stop

```powershell
npm run judge0:down
```

Judge0 officially targets Linux. On Windows, use Docker Desktop with its
WSL 2 Linux engine enabled. The worker needs privileged container support.

The deployment is pinned to Judge0 CE `1.13.1`, which includes the security
fixes for vulnerabilities affecting versions `1.13.0` and older.

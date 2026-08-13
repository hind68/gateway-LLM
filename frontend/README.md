# SecureLLM Frontend

This folder contains the React/Vite interface for Secure LLM Gateway.

The frontend proves the flow:

```text
React -> Spring Boot -> LiteLLM -> LLM provider
```

It uses the backend API at:

```text
http://127.0.0.1:8081/api
```

## Requirements

- Node.js
- npm
- Backend running on `http://127.0.0.1:8081`
- Docker services running from the project root

## Run Locally

From this folder:

```powershell
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

## Available Scripts

```powershell
npm run lint
npm run build
npm run preview
```

## Expected Backend Services

Before using the UI, start the project from the root:

```powershell
docker compose up -d postgres litellm
```

Then start the backend:

```powershell
cd backend
$env:LITELLM_MASTER_KEY="sk-local-litellm"
$env:SPRING_DATASOURCE_URL="jdbc:postgresql://localhost:5433/secure_llm_gateway"
$env:SPRING_DATASOURCE_USERNAME="secure_llm_user"
$env:SPRING_DATASOURCE_PASSWORD="change_me_local_only"
cmd /c mvnw.cmd spring-boot:run
```

Use your local `.env` values if they are different.

## Main Features

- Model selection from the backend catalog
- Persistent conversations
- Conversation history search and filtering
- Streaming assistant responses through SSE
- Markdown rendering with copy actions
- Conversation archive and permanent delete actions

## Troubleshooting

### The UI shows `Failed to fetch`

Check that the backend is running:

```powershell
curl.exe http://127.0.0.1:8081/api/health
```

If the backend is down, the frontend cannot call models, conversations or streaming endpoints.

### No model responds

Check that:

- LiteLLM is running on `http://localhost:4000`;
- the selected provider key exists in the root `.env`;
- `LITELLM_MASTER_KEY` is the same for LiteLLM and the backend.

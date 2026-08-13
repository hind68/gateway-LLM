# Secure LLM Gateway

## Architecture actuelle

- `frontend/src/features/` regroupe les domaines React: `chat`, `conversations`, `layout` et `models`.
- `frontend/src/features/chat/hooks/useChatController.js` coordonne uniquement les workflows qui traversent chat + conversations, par exemple premier envoi, ouverture d'une conversation et chargement du cache messages.
- `backend/src/main/java/com/example/backend/controller/` est separe par domaine: health, chat, models et conversations. Les URLs restent sous `/api`.
- `backend/src/main/java/com/example/backend/integration/litellm/` contient l'integration LiteLLM basee sur `WebClient`.
- `backend/src/main/java/com/example/backend/enums/` contient les enums JPA. Les valeurs stockees en base ne changent pas.

## Notes d'exploitation

- Le backend conserve MVC pour les controleurs HTTP/SSE et WebFlux pour `WebClient`, utilise par l'integration LiteLLM.
- L'image LiteLLM utilise encore le tag `latest`; il faudra figer une version apres validation d'une release precise.
- `--detailed_debug` et `set_verbose: true` sont pratiques en local, mais doivent etre desactives en environnement sensible ou production afin d'eviter des logs trop bavards.

Secure LLM Gateway is a local proof of concept for routing chat requests through a controlled backend before calling LLM providers through LiteLLM.

The current project contains:

- a LiteLLM proxy running with Docker Compose;
- a PostgreSQL database running with Docker Compose;
- a Spring Boot backend in `backend/`;
- a React/Vite frontend in `frontend/`;
- Flyway migrations for the model catalog, conversations and messages.

No real secret must be committed. Local secrets belong only in `.env`.

Provider credentials are intentionally not managed through the admin API or stored in
the database. The current deployment injects provider keys into LiteLLM through the
local environment, while the backend keeps only non-secret provider/model metadata.
The admin model screens can therefore edit aliases, display names, descriptions, logo
URLs and statuses, but changing a provider key still requires the deployment secret
configuration. This prevents credentials from being returned to or persisted by the
frontend.

## Architecture

```text
React frontend
      |
      v
Spring Boot backend
      |
      +--> PostgreSQL: model catalog, conversations, messages
      |
      v
LiteLLM proxy
      |
      v
OpenAI / Groq / Gemini / Mistral
```

Default local URLs:

| Service | URL |
| --- | --- |
| Frontend | `http://localhost:5173` |
| Backend API | `http://127.0.0.1:8081/api` |
| LiteLLM | `http://localhost:4000` |
| PostgreSQL from host | `localhost:5433` |
| PostgreSQL from Docker network | `postgres:5432` |

## Prerequisites

- Git
- Docker Desktop
- Java 17
- Node.js and npm
- At least one provider API key for the model you want to test

Provider keys used by the current LiteLLM config:

| Alias | Display name | Provider model | Required key |
| --- | --- | --- | --- |
| `secure-gpt` | OpenAI GPT-4o mini | `openai/gpt-4o-mini` | `OPENAI_API_KEY` |
| `secure-groq` | Groq Llama 3.1 8B | `groq/llama-3.1-8b-instant` | `GROQ_API_KEY` |
| `secure-gemini` | Gemini 3.6 Flash | `gemini/gemini-3.6-flash` | `GEMINI_API_KEY` |
| `secure-mistral` | Mistral Small | `mistral/mistral-small-latest` | `MISTRAL_API_KEY` |

`secure-claude` is prepared in `litellm/config.yaml` but is commented. Enable it only after adding `ANTHROPIC_API_KEY`.

In the admin model catalog, each provider can reference its API-key environment variable (for example `OPENAI_API_KEY`). The secret value is intentionally not stored in PostgreSQL or returned by the API. Add the value to `.env`, restart LiteLLM, then the admin catalog will show whether the referenced key is configured.

## 1. Configure Environment

From the project root:

```powershell
Copy-Item .env.example .env
```

Fill `.env` with local values:

```env
OPENAI_API_KEY=your_openai_api_key_here
GROQ_API_KEY=your_groq_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
MISTRAL_API_KEY=your_mistral_api_key_here

LITELLM_MASTER_KEY=sk-local-litellm
LITELLM_PORT=4000

POSTGRES_DB=secure_llm_gateway
POSTGRES_USER=secure_llm_user
POSTGRES_PASSWORD=change_me_local_only
POSTGRES_HOST_PORT=5433

SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5433/secure_llm_gateway
SPRING_DATASOURCE_USERNAME=secure_llm_user
SPRING_DATASOURCE_PASSWORD=change_me_local_only
```

Important:

- `.env` is ignored by Git.
- Keep `LITELLM_MASTER_KEY` identical for LiteLLM and the backend.
- Port `5433` is used on the host to avoid common conflicts with local PostgreSQL on `5432`.
- Set the local-only Keycloak variables from `.env.example` in `.env`; the Keycloak administrator password and `gateway-admin` client secret are never committed.

## 2. Start Docker Services

From the project root:

```powershell
docker compose up -d postgres litellm keycloak-db keycloak keycloak-provisioner
```

Check the containers:

```powershell
docker compose ps
```

Useful logs:

```powershell
docker compose logs -f postgres
docker compose logs -f litellm
docker compose logs -f keycloak
```

Keycloak is available at `http://localhost:8080`. The first startup imports the
`synapse` realm, activates the Synapse login theme, creates the `INTERN` and
`EXTERN` roles, and provisions the confidential `gateway-admin` service client.
The Keycloak database is stored in the `keycloak_postgres_data` volume. The
one-shot provisioner may show as exited successfully after startup; rerun it
with `docker compose run --rm keycloak-provisioner` after changing realm
automation.

## 3. Run the Backend

Open a new terminal:

```powershell
cd backend
$env:LITELLM_MASTER_KEY="sk-local-litellm"
$env:SPRING_DATASOURCE_URL="jdbc:postgresql://localhost:5433/secure_llm_gateway"
$env:SPRING_DATASOURCE_USERNAME="secure_llm_user"
$env:SPRING_DATASOURCE_PASSWORD="change_me_local_only"
$env:KEYCLOAK_ADMIN_BASE_URL="http://localhost:8080"
$env:KEYCLOAK_ADMIN_REALM="synapse"
$env:KEYCLOAK_ADMIN_TOKEN_REALM="synapse"
$env:KEYCLOAK_ADMIN_CLIENT_ID="gateway-admin"
$env:KEYCLOAK_ADMIN_CLIENT_SECRET="<the local-only value from .env>"
# On Windows, use IPv4 if Java times out while reading Keycloak on localhost.
$env:JAVA_TOOL_OPTIONS="-Djava.net.preferIPv4Stack=true"
cmd /c mvnw.cmd spring-boot:run
```

Use the same values that you placed in `.env`.

Flyway runs automatically when the backend starts. It creates and validates the PostgreSQL schema. Hibernate uses:

```properties
spring.jpa.hibernate.ddl-auto=validate
```

So database schema changes must be done with Flyway migrations.

## 4. Run the Frontend

Open another terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

The frontend calls:

```text
http://127.0.0.1:8081/api
```

## 5. Quick Verification

Backend health:

```powershell
curl.exe http://127.0.0.1:8081/api/health
```

Available models:

```powershell
curl.exe http://127.0.0.1:8081/api/models/details
```

Simple backend chat test:

```powershell
curl.exe -X POST http://localhost:8080/api/chat `
  -H "Content-Type: application/json" `
  -d "{\"model\":\"secure-groq\",\"message\":\"Bonjour, reponds en une phrase.\"}"
```

Direct LiteLLM test:

```powershell
curl.exe -X POST http://localhost:4000/v1/chat/completions `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer sk-local-litellm" `
  -d "@litellm/examples/request-groq.json"
```

If you changed `LITELLM_MASTER_KEY`, replace `sk-local-litellm` in the Authorization header.

## Main Backend Endpoints

Compatibility endpoint:

- `POST /api/chat`

Conversation endpoints:

- `POST /api/conversations`
- `GET /api/conversations?modelAlias=secure-groq&search=test&archived=false&page=0&size=20`
- `GET /api/conversations/{id}`
- `PATCH /api/conversations/{id}`
- `PATCH /api/conversations/{id}/model`
- `DELETE /api/conversations/{id}` archives a conversation
- `DELETE /api/conversations/{id}/permanent` deletes a conversation permanently
- `GET /api/conversations/{id}/messages`
- `POST /api/conversations/{id}/messages/stream`

The frontend uses the streaming endpoint for progressive assistant responses.

## Database

PostgreSQL is started by Docker Compose. Data is kept in the named volume:

```text
secure_llm_postgres_data
```

Current migrations live in:

```text
backend/src/main/resources/db/migration
```

They create:

- LLM providers and model aliases;
- display names for the frontend;
- a temporary local demo user;
- conversations and messages;
- model attribution per assistant message;
- delete behavior for conversations and linked messages.

To recreate the database from zero during local development:

```powershell
docker compose down -v
docker compose up -d postgres litellm
```

Then restart the backend so Flyway runs again.

## Test Commands Before Sharing

Frontend:

```powershell
cd frontend
npm run lint
npm run build
```

Backend:

```powershell
cd backend
cmd /c mvnw.cmd test
```

Docker Compose syntax:

```powershell
docker compose config
```

## Troubleshooting

### Docker services are not available

Start Docker Desktop, then run:

```powershell
docker compose up -d postgres litellm
```

### PostgreSQL port conflict

The project uses host port `5433` by default:

```env
POSTGRES_HOST_PORT=5433
SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5433/secure_llm_gateway
```

If you change `POSTGRES_HOST_PORT`, update `SPRING_DATASOURCE_URL` too.

### Backend cannot authenticate with LiteLLM

Make sure the backend environment variable and `.env` use the same value:

```env
LITELLM_MASTER_KEY=sk-local-litellm
```

### Provider returns an authentication error

Check that the matching key exists in `.env`. For example, `secure-gemini` requires `GEMINI_API_KEY`.

### Frontend shows Failed to fetch

Usually one of these services is not running:

- backend on `http://127.0.0.1:8081`;
- frontend on `http://localhost:5173`;
- Docker services for PostgreSQL and LiteLLM.

Start Docker, then the backend, then the frontend.

### Maven downloads fail on first run

The first backend run may download Maven dependencies. Make sure the machine has internet access.

## Stop the Project

Stop frontend and backend with `Ctrl+C` in their terminals.

Stop Docker services:

```powershell
docker compose down
```

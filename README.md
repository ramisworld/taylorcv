# Taylor CV

Minimal T3 MVP for AI-assisted CV tailoring.

## Local Setup

1. Install Docker Desktop for Mac.
2. Open Docker Desktop at least once and wait until it says Docker is running.
3. Restart your terminal if `docker` was previously unavailable.
4. Verify the Docker CLI works:

```bash
docker --version
```

If this still returns `zsh: command not found: docker`, Docker Desktop is not installed, has not been opened, or the terminal needs to be restarted so the Docker CLI is on PATH. Do not continue to Prisma until this works.

5. Copy `.env.example` to `.env`.
6. Keep `USE_MOCK_AI="true"` to run the mock flow without OpenAI credentials.
7. Confirm `.env` points at Docker Postgres on host port `5433`:

```bash
DATABASE_URL="postgresql://postgres:password@localhost:5433/tailorcv"
```

8. Reset and start the Docker pgvector database:

```bash
docker compose down -v
docker compose up -d
```

9. Apply migrations:

```bash
npx prisma migrate dev
```

10. Optionally seed the mock dataset:

```bash
npm run db:seed
```

11. Start the app:

```bash
npm run dev
```

The app uses Docker PostgreSQL on host port `5433` so it does not connect to a Mac-installed PostgreSQL server on port `5432`.

## Real OpenAI Mode

Set `USE_MOCK_AI="false"` and provide:

```bash
OPENAI_API_KEY=""
OPENAI_FAST_MODEL=""
OPENAI_STRONG_MODEL=""
OPENAI_EMBEDDING_MODEL="text-embedding-3-small"
```

The embedding schema is fixed to `vector(1536)` for `text-embedding-3-small`.

## Checks

```bash
npm run typecheck
npm run build
```

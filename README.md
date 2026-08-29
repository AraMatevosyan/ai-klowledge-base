# AI Knowledge Base

[![CI](https://github.com/AraMatevosyan/ai-klowledge-base/actions/workflows/ci.yml/badge.svg)](https://github.com/AraMatevosyan/ai-klowledge-base/actions/workflows/ci.yml)

AI Knowledge Base is a production-deployed full-stack RAG application that allows users to upload PDF documents and ask questions based on their content.

The application extracts text from uploaded PDFs, splits it into searchable chunks, generates vector embeddings, retrieves relevant context using PostgreSQL and pgvector, and produces grounded AI answers with citations.

The project demonstrates practical experience with full-stack development, document processing, semantic search, LLM integration, streaming responses, prompt engineering, AI cost control, production deployment, security hardening, testing, and CI automation.

## Live application

- Frontend: [https://ai-klowledge-base-1o15.vercel.app](https://ai-klowledge-base-1o15.vercel.app)
- Backend health check: [https://ai-knowledge-base-backend-75mn.onrender.com/api](https://ai-knowledge-base-backend-75mn.onrender.com/api)
- Source code: [https://github.com/AraMatevosyan/ai-klowledge-base](https://github.com/AraMatevosyan/ai-klowledge-base)

> The backend is hosted on a free Render instance. The first request after a period of inactivity may take additional time while the service starts.

## Features

### Authentication

- User registration and login
- JWT authentication
- Access token stored in an HttpOnly cookie
- Secure production cookie configuration
- Protected backend routes
- User-specific documents and chat history
- Logout support
- Session expiration handling

Production authentication cookies use:

```text
HttpOnly
Secure
SameSite=Lax
Path=/
```

### Document management

- PDF upload
- Maximum file size validation
- MIME type validation
- Document ownership validation
- Document processing statuses:
  - `UPLOADING`
  - `PROCESSING`
  - `READY`
  - `FAILED`
- Retry failed document processing
- Concurrent retry protection
- Delete documents
- Responsive desktop and mobile layouts
- Empty, loading, processing, and error states

### Document processing

- PDF text extraction
- Page-number preservation
- Text normalization
- Paragraph-aware chunking
- Chunk overlap
- OpenAI embeddings
- Vector storage with PostgreSQL and pgvector
- Transactional database updates
- Recoverable failed-processing state

### AI chat

- Questions across all uploaded and ready documents
- Multi-document retrieval
- Query intent detection
- Factual questions
- Single-document summaries
- Multi-document summaries
- Comparison questions
- Exhaustive questions
- Streaming AI responses
- Persisted chat history
- Clear chat history
- Grounded answers
- Numbered citations
- Source document names
- Source page numbers
- Sanitized source excerpts
- Explicit no-context responses

### User experience

- Responsive Dashboard
- Responsive document cards on mobile
- Responsive chat interface
- Loading and processing indicators
- Retry actions
- Delete confirmation
- Clear-history confirmation
- Application usage guide
- Example questions
- Global action blocking during upload, retry, and AI streaming
- User-friendly daily budget errors
- Consistent English UI text

### Daily AI usage budget

The application enforces a daily AI spending limit for each user.

The budget applies to:

- document embedding generation;
- semantic-search query embeddings;
- regular AI answers;
- streaming AI answers.

Before an OpenAI request is made, the maximum estimated request cost is reserved.

After the request completes, the reservation is replaced with the actual cost calculated from:

- chat input tokens;
- cached chat input tokens;
- chat output tokens;
- embedding tokens.

Unused reservations are released when an OpenAI request fails.

The limit resets every day at `00:00 UTC`.

When the limit is exceeded, the backend returns:

```text
code: DAILY_AI_BUDGET_EXCEEDED
resetAt: next UTC reset time
```

For regular endpoints, the error is returned as JSON.

For the streaming endpoint, the same error information is delivered through the NDJSON stream and displayed as an English Alert on the frontend.

Pricing configuration must match the models configured through:

```text
OPENAI_CHAT_MODEL
OPENAI_EMBEDDING_MODEL
```

## Tech stack

### Frontend

- Next.js
- React
- TypeScript
- Material UI
- TanStack React Query

### Backend

- Node.js
- NestJS
- TypeScript
- Prisma ORM
- Express

### Database

- PostgreSQL
- pgvector

### AI

- OpenAI Responses API
- OpenAI Embeddings API

### Infrastructure

- Docker
- Docker Compose
- Vercel
- Render
- GitHub Actions

### Testing and code quality

- Jest
- NestJS Testing Module
- ESLint
- Prettier
- npm audit
- GitHub Actions CI

## Production architecture

```mermaid
flowchart TD
    Browser["Browser"] --> Frontend["Next.js on Vercel"]
    Frontend --> Proxy["Same-origin /api proxy"]
    Proxy --> Backend["NestJS on Render"]

    Backend --> Database["PostgreSQL + pgvector"]
    Backend --> OpenAI["OpenAI API"]
    Backend --> Storage["Container PDF storage"]
```

The browser communicates with the same-origin `/api` route exposed by the Next.js deployment.

Next.js proxies API requests to the Render backend. This allows authentication cookies to remain first-party from the browser's perspective.

The NestJS backend owns:

- authentication;
- document processing;
- retrieval;
- prompt construction;
- OpenAI communication;
- budget enforcement;
- data access.

PostgreSQL stores:

- users;
- document metadata;
- extracted pages;
- document chunks;
- vector embeddings;
- chat messages;
- daily AI usage.

## Application architecture

The frontend and backend are stored in the same repository but remain independently deployable applications.

```text
Browser
    ↓
Next.js frontend
    ↓
NestJS REST API
    ↓
Application services
    ↓
Prisma / PostgreSQL / OpenAI / File system
```

### Frontend responsibilities

The frontend handles:

- authentication screens;
- session loading;
- document upload UI;
- document status rendering;
- retry and delete actions;
- chat rendering;
- NDJSON stream processing;
- error presentation;
- responsive layouts;
- action coordination.

### Backend responsibilities

The backend handles:

- request validation;
- authentication and authorization;
- document ownership;
- PDF processing;
- chunking and embeddings;
- semantic retrieval;
- answer generation;
- streaming;
- budget accounting;
- message persistence;
- safe production errors.

## RAG pipeline

### Document indexing

```mermaid
flowchart TD
    PDF["Uploaded PDF"] --> Extract["Extract text by page"]
    Extract --> Normalize["Normalize text"]
    Normalize --> Chunk["Create overlapping chunks"]
    Chunk --> Reserve["Reserve embedding budget"]
    Reserve --> Embed["Generate embeddings"]
    Embed --> Store["Store chunks and vectors"]
    Store --> Settle["Settle actual usage"]
    Settle --> Ready["Document status: READY"]
```

If processing fails, the document status changes to `FAILED` and the user can retry processing.

### Question answering

```mermaid
flowchart TD
    Question["User question"] --> Intent["Detect query intent"]
    Intent --> Retrieval["Select retrieval strategy"]
    Retrieval --> Search["Retrieve document chunks"]
    Search --> Context["Build grounded context"]
    Context --> Reserve["Reserve chat budget"]
    Reserve --> LLM["Generate answer"]
    LLM --> Stream["Stream response"]
    Stream --> Settle["Settle actual token cost"]
    Settle --> Sources["Return cited sources"]
```

## Multi-document retrieval

The chat is knowledge-base scoped rather than restricted to a single document.

A user can upload multiple documents and ask questions that require information from one or several files.

Examples:

```text
Summarize all uploaded documents.

Compare the information in the uploaded documents.

Which technologies are mentioned in the resume?

What is the total amount shown in the invoice?
```

Supported query intents include:

- `FACTUAL`
- `SUMMARY_SINGLE`
- `SUMMARY_ALL`
- `EXHAUSTIVE`
- `COMPARISON`

Factual questions prioritize chunks with the highest semantic relevance.

Summary and comparison questions use broader document coverage so that important documents are not excluded only because of a low similarity score.

When a single-document summary is ambiguous and several documents are available, the application asks the user to clarify which document should be summarized.

## Grounding and hallucination prevention

The model receives explicit instructions to:

- answer using only the provided document context;
- avoid inventing facts;
- distinguish between related technical categories;
- state when the documents do not contain enough information;
- cite sources used in the answer;
- avoid exposing unnecessary sensitive information.

Example fallback response:

```text
I couldn't find enough information in the uploaded documents.
```

The system distinguishes between facts that are present in a document and assumptions that cannot be verified.

For example, an invoice may prove that an amount was billed, but it does not prove that the amount was paid.

## Citations

Each context chunk receives a source number:

```text
[1]
Document: invoice.pdf
Page: 1

Relevant content...
```

The generated answer references sources using the same number:

```text
The total amount payable is EUR 700 [1].
```

After answer generation, citation filtering removes context chunks that were not cited by the model.

Source numbers are not renumbered after filtering because they must continue to match the citations in the answer.

## Source sanitization

Raw document context is used internally for retrieval and answer generation.

Before source excerpts are returned to the frontend or stored in chat history, sensitive fields are sanitized.

The sanitizer handles information such as:

- email addresses;
- phone numbers;
- URLs;
- full street addresses;
- tax identifiers;
- bank account numbers;
- SWIFT values;
- IBAN values;
- banking details.

Example:

```text
Yerevan, Armenia · [phone redacted] · [email redacted]
```

The sanitizer operates only on public source excerpts.

It does not modify the original uploaded document or internal chunks used by the RAG pipeline.

## Streaming protocol

The streaming endpoint uses newline-delimited JSON:

```text
POST /api/chat/ask/stream
Content-Type: application/x-ndjson
```

Example events:

```json
{"type":"delta","content":"The document"}
{"type":"delta","content":" describes..."}
{"type":"complete","data":{"status":"ANSWERED","answer":"...","sources":[]}}
```

Budget and application errors are also returned through the stream:

```json
{
  "type": "error",
  "code": "DAILY_AI_BUDGET_EXCEEDED",
  "message": "Your daily AI usage limit has been reached.",
  "resetAt": "2026-08-30T00:00:00.000Z"
}
```

The frontend reads the response incrementally and updates the assistant message as new delta events arrive.

## Database design

```mermaid
erDiagram
    USER ||--o{ DOCUMENT : uploads
    DOCUMENT ||--o{ DOCUMENT_PAGE : contains
    DOCUMENT ||--o{ DOCUMENT_CHUNK : contains
    USER ||--o{ MESSAGE : owns
    USER ||--o{ AI_DAILY_USAGE : consumes
```

### User

Stores authentication information.

Important fields:

```text
id
email
passwordHash
createdAt
```

### Document

Stores uploaded document metadata and processing state.

Important fields:

```text
id
userId
name
mimeType
size
storageKey
status
pageCount
chunkCount
errorMessage
createdAt
updatedAt
```

### DocumentPage

Stores extracted text with its original PDF page number.

Important fields:

```text
id
documentId
pageNumber
text
```

### DocumentChunk

Stores searchable document sections and vector embeddings.

Important fields:

```text
id
documentId
pageNumber
chunkIndex
content
embedding
createdAt
```

### Message

Stores global knowledge-base chat history for a user.

Important fields:

```text
id
userId
role
content
sources
createdAt
```

### AiDailyUsage

Stores reserved and consumed AI cost for a user and UTC usage date.

The monetary values are stored using integer nano-USD units to avoid floating-point accounting errors.

## Project structure

```text
ai-klowledge-base/
├── .github/
│   └── workflows/
│       └── ci.yml
├── backend/
│   ├── prisma/
│   │   ├── migrations/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── ai/
│   │   ├── auth/
│   │   ├── chat/
│   │   ├── common/
│   │   ├── documents/
│   │   ├── generated/
│   │   ├── prisma/
│   │   ├── search/
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── storage/
│   │   └── documents/
│   ├── Dockerfile
│   ├── prisma.config.ts
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── features/
│   │   │   ├── auth/
│   │   │   ├── chat/
│   │   │   └── documents/
│   │   ├── lib/
│   │   └── theme.ts
│   ├── Dockerfile
│   └── package.json
├── .env.compose.example
├── compose.yaml
└── README.md
```

## Code architecture

### Frontend architecture

The frontend uses a feature-oriented structure.

Each feature contains its own:

- API functions;
- React Query hooks;
- TypeScript types;
- UI components.

Example:

```text
features/documents/
├── components/
├── documents.api.ts
├── documents.queries.ts
└── documents.types.ts
```

TanStack React Query manages:

- server state;
- caching;
- mutations;
- loading states;
- query invalidation.

Local component state is used for temporary UI state such as:

- dialogs;
- input values;
- streamed content;
- temporary errors.

Shared React Query mutation keys prevent conflicting operations during:

- document upload;
- document retry;
- AI streaming.

### Backend architecture

The backend follows the NestJS module structure:

```text
Controller
    ↓
Service
    ↓
Prisma / OpenAI / File system
```

Responsibilities are separated:

- controllers handle HTTP input and output;
- DTOs validate request data;
- guards protect authenticated routes;
- services contain business logic;
- Prisma handles database access;
- AI services wrap OpenAI operations;
- utility functions handle citations and sanitization;
- exception filters provide safe production errors.

The upload and retry flows use the same internal document-processing method to prevent duplicated processing logic.

## API endpoints

All backend endpoints use the `/api` prefix.

### Authentication

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register a user |
| `POST` | `/api/auth/login` | Log in |
| `GET` | `/api/auth/me` | Get the authenticated user |
| `POST` | `/api/auth/logout` | Log out |

### Documents

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/documents` | Get the current user's documents |
| `POST` | `/api/documents/upload` | Upload and process a PDF |
| `POST` | `/api/documents/:id/retry` | Retry a failed document |
| `DELETE` | `/api/documents/:id` | Delete a document |

### Search

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/search` | Run semantic search |

### Chat

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/chat/ask` | Generate a complete answer |
| `POST` | `/api/chat/ask/stream` | Stream an answer |
| `GET` | `/api/chat/messages` | Get chat history |
| `DELETE` | `/api/chat/messages` | Clear chat history |

## Environment variables

### Backend

Create `backend/.env` based on `backend/.env.example`.

Required groups:

```env
# Application
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:3000
TRUST_PROXY_HOPS=0

# Database
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55432/ai_knowledge_base?schema=public

# Authentication
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN_SECONDS=604800

# OpenAI
OPENAI_API_KEY=your-openai-api-key
OPENAI_CHAT_MODEL=gpt-4.1-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# Storage
UPLOAD_DIR=storage/documents

# Daily AI budget
DAILY_AI_BUDGET_USD=replace-with-your-daily-budget

OPENAI_CHAT_INPUT_USD_PER_MILLION_TOKENS=replace-with-current-price
OPENAI_CHAT_CACHED_INPUT_USD_PER_MILLION_TOKENS=replace-with-current-price
OPENAI_CHAT_OUTPUT_USD_PER_MILLION_TOKENS=replace-with-current-price
OPENAI_EMBEDDING_USD_PER_MILLION_TOKENS=replace-with-current-price
```

Pricing variables must match the models configured through `OPENAI_CHAT_MODEL` and `OPENAI_EMBEDDING_MODEL`.

### Frontend development

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

### Frontend production

The Vercel deployment uses a same-origin API proxy:

```env
NEXT_PUBLIC_API_URL=/api
BACKEND_URL=https://ai-knowledge-base-backend-75mn.onrender.com
```

### Backend production

Important Render variables include:

```env
NODE_ENV=production
FRONTEND_URL=https://ai-klowledge-base-1o15.vercel.app
TRUST_PROXY_HOPS=1
```

Render provides the production `PORT`.

The production `DATABASE_URL`, `JWT_SECRET`, `OPENAI_API_KEY`, and budget variables must be stored as Render environment variables.

Never commit real secrets or API keys.

## Running locally

### Prerequisites

Install:

- Node.js 22
- npm
- Docker
- Docker Compose

### 1. Clone the repository

```bash
git clone https://github.com/AraMatevosyan/ai-klowledge-base.git

cd ai-klowledge-base
```

### 2. Start PostgreSQL

Create the Compose environment file:

```bash
cp .env.compose.example .env.compose
```

Start PostgreSQL with pgvector:

```bash
docker compose \
  --env-file .env.compose \
  up -d postgres
```

Check the container:

```bash
docker compose \
  --env-file .env.compose \
  ps
```

### 3. Configure backend

```bash
cd backend

cp .env.example .env

npm ci
```

Add the required values to `.env`.

Generate Prisma Client:

```bash
npm run prisma:generate
```

Apply existing migrations:

```bash
npm run prisma:migrate:deploy
```

Start the backend:

```bash
npm run start:dev
```

The backend will be available at:

```text
http://localhost:3001/api
```

### 4. Configure frontend

Open another terminal:

```bash
cd frontend

cp .env.example .env.local

npm ci
npm run dev
```

The frontend will be available at:

```text
http://localhost:3000
```

## Running the complete stack with Docker

Create the Compose environment file:

```bash
cp .env.compose.example .env.compose
```

Fill in the required secrets and start the complete stack:

```bash
docker compose \
  --env-file .env.compose \
  up --build
```

Services:

```text
Frontend:   http://localhost:3000
Backend:    http://localhost:3001/api
PostgreSQL: 127.0.0.1:55432
```

Database migrations are applied automatically by the migration service.

Stop the stack:

```bash
docker compose \
  --env-file .env.compose \
  down
```

## Development commands

### Backend

```bash
npm run start:dev
npm run build
npm run start:prod

npm run lint
npm run lint:fix

npm run format
npm run format:check
npm run code-style:fix

npm test
npm run test:watch
npm run test:cov

npm run prisma:generate
npm run prisma:migrate:status
npm run prisma:migrate:deploy
```

### Frontend

```bash
npm run dev
npm run build
npm run start

npm run lint
npm run lint:fix

npm run format
npm run format:check
npm run code-style:fix
```

## Tests

The backend uses Jest and NestJS Testing Module.

Run all tests:

```bash
cd backend

npm test -- --runInBand
```

Run tests with coverage:

```bash
npm run test:cov -- --runInBand
```

Run a specific test suite:

```bash
npm test -- chat.service --runInBand
npm test -- chat.controller --runInBand
npm test -- documents.service --runInBand
npm test -- search.service --runInBand
npm test -- embeddings.service --runInBand
npm test -- answer-generation.service --runInBand
npm test -- ai-budget.service --runInBand
npm test -- citation.utils --runInBand
npm test -- source-excerpt-sanitizer --runInBand
```

### Covered behavior

The tests cover:

- query intent classification;
- citation extraction;
- citation range parsing;
- cited-source filtering;
- sensitive source sanitization;
- document ownership;
- retry status validation;
- missing PDF handling;
- concurrent retry protection;
- document reprocessing;
- semantic retrieval;
- summary retrieval;
- multi-document retrieval;
- search availability states;
- chat availability states;
- no-relevant-context responses;
- regular answer generation;
- streaming answer generation;
- source filtering;
- source sanitization;
- message persistence;
- chat history deletion;
- daily AI budget reservations;
- actual usage settlement;
- failed-request reservation release;
- regular chat budget errors;
- streaming chat budget errors;
- embedding budget accounting.

## Continuous integration

GitHub Actions runs automatically for:

- pushes to `main`;
- pull requests targeting `main`;
- manual workflow runs.

The CI workflow contains separate backend and frontend jobs.

### Backend CI

The backend job:

1. starts PostgreSQL with pgvector;
2. installs dependencies with `npm ci`;
3. runs `npm audit`;
4. generates Prisma Client;
5. applies database migrations;
6. checks formatting;
7. runs ESLint;
8. runs all Jest tests;
9. creates a production build.

### Frontend CI

The frontend job:

1. installs dependencies with `npm ci`;
2. runs `npm audit`;
3. checks formatting;
4. runs ESLint;
5. creates a production build.

The workflow is defined in:

```text
.github/workflows/ci.yml
```

## Code style

The project uses ESLint and Prettier.

Formatting conventions:

- TypeScript for frontend and backend;
- single quotes;
- semicolons;
- trailing commas;
- four-space indentation;
- 80-character print width;
- LF line endings.

Generated Prisma Client files are excluded from formatting and linting.

Apply formatting and automatic ESLint fixes:

```bash
npm run code-style:fix
```

Check formatting without changing files:

```bash
npm run format:check
```

Run ESLint:

```bash
npm run lint
```

The codebase should pass formatting, linting, tests, security audit, and production builds before being merged.

## Production build

### Backend

```bash
cd backend

npm ci
npm run prisma:generate
npm run build
npm run start:prod
```

### Frontend

```bash
cd frontend

npm ci
npm run build
npm run start
```

## Deployment

### Backend

The backend is deployed to Render as a Docker service.

The production container:

1. installs production dependencies;
2. includes the compiled NestJS application;
3. includes Prisma schema and migrations;
4. applies migrations using `prisma migrate deploy`;
5. starts the application as a non-root user;
6. exposes a Docker health check.

### Frontend

The frontend is deployed to Vercel.

Vercel:

- builds the Next.js application;
- exposes the production frontend;
- proxies `/api` requests to Render;
- keeps authentication requests same-origin.

### Database

PostgreSQL is hosted on Render.

The database uses the pgvector extension for semantic vector search.

## Security and privacy

Implemented protections include:

- password hashing;
- HttpOnly authentication cookies;
- Secure cookies in production;
- SameSite cookie protection;
- Helmet security headers;
- exact-origin CORS configuration;
- trusted proxy configuration;
- global DTO validation;
- unknown-field rejection;
- guarded backend endpoints;
- document ownership checks;
- user-scoped database queries;
- PDF MIME type validation;
- PDF size validation;
- safe file path resolution;
- sanitized public source excerpts;
- safe production error messages;
- no API keys exposed to the browser;
- daily per-user AI spending limits;
- dependency auditing in CI;
- non-root Docker runtime.

Uploaded document content is sent to the configured OpenAI API for embeddings and answer generation.

Do not upload confidential, regulated, or highly sensitive files to the public portfolio deployment.

## Known limitations

The project intentionally has a limited portfolio MVP scope.

Current limitations:

- PDF files only;
- no OCR for scanned image-only PDFs;
- container-local PDF storage;
- Render storage is ephemeral;
- uploaded files may be lost after a redeploy or container replacement;
- synchronous document processing;
- one global chat history per user;
- no multiple-conversation support;
- no hybrid keyword and vector search;
- no cross-encoder reranking;
- no background job queue;
- no organizations or teams;
- no role-based access control;
- no cloud object storage;
- free Render instances may have cold starts.

Database metadata remains persistent, but locally stored PDF files may not survive a Render redeploy.

Cloud object storage was intentionally deferred for the current portfolio version.

## Future improvements

Possible production improvements:

- Cloudflare R2 or S3-compatible object storage;
- OCR support;
- background processing with BullMQ;
- Redis-backed job queues;
- hybrid keyword and vector search;
- cross-encoder reranking;
- query rewriting;
- document filters inside the global knowledge base;
- multiple conversations;
- evaluation datasets;
- retrieval quality metrics;
- answer-quality monitoring;
- structured logging;
- error monitoring;
- distributed tracing;
- custom production domain.

## Portfolio highlights

This project demonstrates more than a direct LLM API request:

```text
Document
    ↓
Text extraction
    ↓
Chunking
    ↓
Embeddings
    ↓
Vector database
    ↑
Question embedding
    ↓
Intent-aware multi-document retrieval
    ↓
Grounded LLM context
    ↓
Streaming answer
    ↓
Citations and sanitized sources
```

Key engineering areas demonstrated:

- React and Next.js application architecture;
- NestJS backend architecture;
- PostgreSQL and Prisma;
- vector search with pgvector;
- OpenAI API integration;
- RAG design;
- intent-aware multi-document retrieval;
- streaming protocols;
- prompt engineering;
- hallucination prevention;
- daily AI cost control;
- authentication and ownership;
- production security configuration;
- responsive UI;
- automated testing;
- CI automation;
- Docker deployment;
- Vercel and Render deployment;
- production-oriented error handling;
- code quality and dependency security.

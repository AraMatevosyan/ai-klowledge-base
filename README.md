# AI Knowledge Base

AI Knowledge Base is a full-stack RAG application that allows users to upload PDF documents and ask questions about their content.

The application extracts text from uploaded PDFs, splits it into searchable chunks, generates vector embeddings, retrieves relevant context with PostgreSQL and pgvector, and produces grounded AI answers with citations.

The project demonstrates practical experience with full-stack development, document processing, semantic search, LLM integration, streaming responses, prompt engineering and AI application architecture.

## Features

### Authentication

- User registration and login
- JWT authentication
- Access token stored in an HttpOnly cookie
- Protected backend routes
- User-specific documents and chat history
- Logout support

### Document management

- PDF upload
- Maximum file size validation
- MIME type validation
- Local file storage
- Document processing statuses:
    - `UPLOADING`
    - `PROCESSING`
    - `READY`
    - `FAILED`
- Retry failed document processing
- Delete documents
- Responsive document list
- Empty, loading and error states

### Document processing

- PDF text extraction
- Page-number preservation
- Text normalization
- Paragraph-aware chunking
- Chunk overlap
- OpenAI embeddings
- Vector storage with PostgreSQL and pgvector

### AI chat

- Questions across all uploaded and ready documents
- Multi-document retrieval
- Query intent detection
- Summary queries
- Comparison queries
- Exhaustive queries
- Factual queries
- Streaming AI responses
- Persisted chat history
- Clear chat history
- Grounded answers
- Numbered citations
- Source document names
- Source page numbers
- Sanitized source excerpts

### User experience

- Responsive Dashboard
- Responsive document cards on mobile
- Responsive chat interface
- Loading and processing states
- Retry actions
- Delete confirmation
- Application usage guide
- Example questions
- Global action blocking during upload, retry and AI streaming

### Daily AI usage budget

The application enforces a daily AI spending limit for each user.

Before an OpenAI request is made, the maximum estimated request cost is reserved. After the request completes, the reservation is replaced with the actual cost calculated from input, cached input, output, or embedding tokens.

Unused reservations are released when an OpenAI request fails.

The limit resets every day at 00:00 UTC.

Required environment variables:

- `DAILY_AI_BUDGET_USD`
- `OPENAI_CHAT_INPUT_USD_PER_MILLION_TOKENS`
- `OPENAI_CHAT_CACHED_INPUT_USD_PER_MILLION_TOKENS`
- `OPENAI_CHAT_OUTPUT_USD_PER_MILLION_TOKENS`
- `OPENAI_EMBEDDING_USD_PER_MILLION_TOKENS`

Pricing values must match the OpenAI models configured by `OPENAI_CHAT_MODEL` and `OPENAI_EMBEDDING_MODEL`.

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

### Database

- PostgreSQL
- pgvector

### AI

- OpenAI Responses API
- OpenAI Embeddings API

### Infrastructure

- Docker
- Docker Compose
- Local PDF storage

### Testing and code quality

- Jest
- NestJS Testing Module
- ESLint
- Prettier

## Architecture

```mermaid
flowchart LR
    User["User"] --> Web["Next.js frontend"]
    Web --> API["NestJS API"]
    API --> Auth["JWT authentication"]
    API --> Storage["PDF storage"]
    API --> Database["PostgreSQL + pgvector"]
    API --> OpenAI["OpenAI API"]
    Database --> API
    OpenAI --> API
    API --> Web
```

The frontend is responsible for authentication screens, document management, chat rendering, streaming updates and user interaction.

The NestJS backend owns authentication, document processing, retrieval, prompt construction, OpenAI communication and data access.

PostgreSQL stores users, document metadata, extracted pages, document chunks, vector embeddings and chat messages.

## RAG pipeline

### Document indexing

```mermaid
flowchart TD
    PDF["Uploaded PDF"] --> Extract["Extract text by page"]
    Extract --> Normalize["Normalize text"]
    Normalize --> Chunk["Split into overlapping chunks"]
    Chunk --> Embed["Generate embeddings"]
    Embed --> Store["Store chunks and vectors in PostgreSQL"]
    Store --> Ready["Document status: READY"]
```

### Question answering

```mermaid
flowchart TD
    Question["User question"] --> Intent["Detect query intent"]
    Intent --> QueryEmbedding["Generate question embedding"]
    QueryEmbedding --> Search["Search pgvector"]
    Search --> Retrieval["Select relevant document chunks"]
    Retrieval --> Context["Build document context"]
    Context --> LLM["Generate grounded answer"]
    LLM --> Stream["Stream answer to frontend"]
    Stream --> Sources["Return cited sources"]
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

The retrieval strategy depends on the detected query intent.

Supported intents include:

- `FACTUAL`
- `SUMMARY_SINGLE`
- `SUMMARY_ALL`
- `EXHAUSTIVE`
- `COMPARISON`

Factual questions prioritize the most relevant chunks. Summary and comparison questions use broader document coverage so that important documents are not excluded only because of a low semantic similarity score.

## Grounding and hallucination prevention

The model receives explicit instructions to:

- answer using only the provided document context;
- avoid inventing facts;
- distinguish between related technical categories;
- state when the documents do not contain enough information;
- cite the sources used in the answer;
- avoid exposing unnecessary sensitive information.

Example fallback response:

```text
I couldn't find enough information in the uploaded documents.
```

The system distinguishes between information that is present in a document and assumptions that cannot be verified.

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
- SWIFT and IBAN values;
- banking details.

Example:

```text
Yerevan, Armenia · [phone redacted] · [email redacted]
```

The sanitizer operates only on public source excerpts. It does not modify the original uploaded document or the internal chunks used by the RAG pipeline.

## Streaming

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

The frontend reads the response stream and updates the assistant message incrementally.

## Database design

```mermaid
erDiagram
    USER ||--o{ DOCUMENT : uploads
    DOCUMENT ||--o{ DOCUMENT_PAGE : contains
    DOCUMENT ||--o{ DOCUMENT_CHUNK : contains
    USER ||--o{ MESSAGE : owns
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

## Project structure

```text
ai-knowledge-base/
├── backend/
│   ├── prisma/
│   │   ├── migrations/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── ai/
│   │   ├── auth/
│   │   ├── chat/
│   │   ├── documents/
│   │   ├── prisma/
│   │   ├── search/
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── storage/
│   │   └── documents/
│   ├── jest.config.cjs
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
│   └── package.json
├── docker-compose.yml
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

TanStack React Query manages server state, caching, mutations and query invalidation.

Local component state is used for temporary UI state such as:

- open dialogs;
- input values;
- streamed message content;
- error messages.

Shared application operations use React Query mutation keys to prevent conflicting actions during:

- document upload;
- document retry;
- AI streaming.

### Backend architecture

The backend follows the NestJS module structure.

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
- services contain business logic;
- Prisma handles database access;
- AI services wrap OpenAI operations;
- utility functions handle citations and sanitization.

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

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:<POSTGRES_PORT>/ai_knowledge_base?schema=public

JWT_SECRET=replace-with-a-long-random-secret

OPENAI_API_KEY=your-openai-api-key
OPENAI_CHAT_MODEL=gpt-4.1-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

UPLOAD_DIR=storage/documents

PORT=3001
FRONTEND_URL=http://localhost:3000
```

`<POSTGRES_PORT>` must match the host port configured in `docker-compose.yml`.

### Frontend

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

Never commit real secrets or API keys.

## Running locally

### Prerequisites

Install:

- Node.js 20 or newer
- npm
- Docker
- Docker Compose

### 1. Clone the repository

```bash
git clone <repository-url>
cd ai-knowledge-base
```

### 2. Start PostgreSQL

```bash
docker compose up -d postgres
```

Check the container:

```bash
docker compose ps
```

### 3. Configure backend

```bash
cd backend
cp .env.example .env
npm install
```

Add the required values to `.env`.

Generate Prisma Client:

```bash
npx prisma generate
```

Apply existing migrations:

```bash
npx prisma migrate deploy
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
npm install
npm run dev
```

The frontend will be available at:

```text
http://localhost:3000
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
npm run code-style:fix
npm test
npm run test:watch
npm run test:cov
```

### Frontend

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run lint:fix
npm run format
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
npm test -- documents.service --runInBand
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
- document ownership checks;
- retry status validation;
- missing PDF handling;
- concurrent retry protection;
- chat availability states;
- no-relevant-context responses;
- non-streaming answer generation;
- streaming answer generation;
- source filtering and sanitization;
- message persistence;
- chat history deletion.

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

Code should pass formatting, linting, tests and production builds before being merged.

## Production build

### Backend

```bash
cd backend
npx prisma generate
npm run build
npm run start:prod
```

### Frontend

```bash
cd frontend
npm run build
npm run start
```

## Security and privacy

Implemented protections include:

- password hashing;
- HttpOnly authentication cookie;
- guarded backend endpoints;
- document ownership checks;
- user-scoped database queries;
- PDF type and size validation;
- safe file path resolution;
- sanitized public source excerpts;
- no API keys exposed to the browser.

Uploaded documents are processed by the backend and relevant content is sent to the configured OpenAI API for embeddings and answer generation.

Do not upload confidential, regulated or highly sensitive files to the public portfolio deployment.

## Known limitations

The project intentionally has a limited MVP scope.

Current limitations:

- PDF files only;
- no OCR for scanned image-only PDFs;
- local file storage;
- synchronous document processing;
- one global chat history per user;
- no hybrid keyword and vector search;
- no cross-encoder reranking;
- no background job queue;
- no organizations or teams;
- no role-based access control;
- no cloud object storage.

## Future improvements

Possible production improvements:

- OCR support;
- S3-compatible object storage;
- background processing with BullMQ;
- Redis;
- hybrid search;
- cross-encoder reranking;
- query rewriting;
- document filters inside the global knowledge base;
- multiple conversations;
- evaluation datasets;
- retrieval quality metrics;
- rate limiting;
- refresh-token rotation;
- structured logging and monitoring;
- automated CI/CD;
- cloud deployment.

## Portfolio highlights

This project demonstrates more than a direct LLM request:

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
Multi-document retrieval
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
- multi-document retrieval;
- streaming protocols;
- prompt engineering;
- hallucination prevention;
- authentication and ownership;
- responsive UI;
- unit testing;
- error handling;
- production-oriented code quality.

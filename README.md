# Student Notes Hub

A mobile-friendly **Course Notes Reader, Teacher Studio, and AI Smart Tutor** designed so faculty can upload or link course materials (PDF, DOCX, PPTX, Google Drive / Docs / Slides) and students can study cleanly on mobile or desktop with offline-resilient caching, interactive reading, flashcards, practice quizzes, and RAG-powered AI Q&A backed by **ChromaDB Cloud**.

---

## Live Portals (Split Architecture)

When deployed with **GitHub Pages (Frontend)** + **Render (Backend)**, both portals share the same static deployment via hash routes:

- **Student Study Portal:** `https://<your-github-username>.github.io/<repo-name>/#/student`
- **Teacher / Faculty Studio:** `https://<your-github-username>.github.io/<repo-name>/#/teacher` (also accessible at `#/faculty`)
- **Backend Health Endpoint:** `https://<your-render-service>.onrender.com/api/health`

---

## System Architecture

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                    GITHUB PAGES (Static Frontend CDN)                    │
│          Student Portal (#/student)  |  Teacher Studio (#/teacher)       │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │ HTTPS JSON API (/api/*)
                                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                 RENDER.COM (Node.js + Express Backend)                   │
│  • Parses PDF / DOCX / PPTX & Google Drive / Docs / Slides links         │
│  • Indexes note chunks & embeddings into ChromaDB Cloud                  │
│  • Proxies AI Smart Tutor & Quiz requests (Gemini / OpenRouter / Groq)   │
│  • Auto-recovers local ./data cache from ChromaDB Cloud on restarts      │
└──────────────┬───────────────────────────────────────────┬───────────────┘
               │                                           │
               ▼                                           ▼
┌────────────────────────────────────┐    ┌────────────────────────────────┐
│          CHROMADB CLOUD            │    │         AI PROVIDERS           │
│  Database: rag-notes-application1  │    │  • Google Gemini (GEMINI_KEY)  │
│  Collection: student_notes         │    │  • OpenRouter (Fallback)       │
│  (Persistent cloud note & RAG store│    │  • Groq (Fast Llama fallback)  │
└────────────────────────────────────┘    └────────────────────────────────┘
```

---

## Secret Keys & Environment Variables

> **Security Rule:** Never commit `.env` files or paste live secret keys into GitHub repositories, frontend `VITE_*` variables, or Markdown docs.
> Backend secret keys belong **only** in **Render → Environment** (for production) or your local **`.env`** file (git-ignored).
> Frontend variables prefixed with `VITE_` are compiled publicly into the browser bundle—never put secret API keys into `VITE_*` variables.

### 1. Backend Secret Keys (Set in Render Environment & Local `.env`)

| Variable | Required | Where to Get It | Purpose |
|---|---|---|---|
| `CHROMA_API_KEY` | **Recommended** | [ChromaDB Cloud](https://www.trychroma.com/) → Database → **Connect / API Keys** | Authenticates backend writes/reads to ChromaDB Cloud so uploaded teacher notes persist across Render restarts. |
| `CHROMA_TENANT` | **Recommended** | ChromaDB Cloud → **Settings** or **Connect** snippet (Tenant UUID) | Identifies your ChromaDB Cloud tenant/organization. |
| `CHROMA_DATABASE` | **Recommended** | ChromaDB Cloud dashboard (Default: `rag-notes-application1`) | Target ChromaDB database storing your course notes. |
| `CHROMA_COLLECTION` | **Recommended** | Auto-created if missing (Default: `student_notes`) | Collection name where chunked notes and metadata are stored. |
| `GEMINI_API_KEY` | **Recommended** *(1 AI key needed)* | [Google AI Studio](https://aistudio.google.com/app/apikey) → **Create API Key** | Powers the AI Smart Tutor (RAG), topic explanations, and exam quiz/flashcard generation. |
| `OPENROUTER_API_KEY` | Optional (Fallback) | [OpenRouter Keys](https://openrouter.ai/keys) | Secondary/fallback LLM provider if Gemini is unset or rate-limited (also accepts `OPEN_ROUTER_API_KEY`). |
| `GROQ_API_KEY` | Optional (Fallback) | [Groq Console](https://console.groq.com/keys) | Fast Llama 3.3 / Mixtral inference fallback (also accepts `GROK_API_KEY`). |

### 2. Backend Runtime & Server Configuration (Set in Render Environment)

| Variable | Default / Example | Purpose |
|---|---|---|
| `NODE_ENV` | `production` | Runs Express in production mode and serves compiled assets from `dist/`. |
| `PORT` | Auto-set by Render (`3000` local, `8080` Docker) | HTTP port Express binds to. Do not hardcode on Render; Render injects `PORT`. |
| `DATA_DIR` | `./data` | Disk folder for temporary JSON metadata & parsed PDFs (set to your mount path if attaching a paid Render Disk). |
| `NODE_OPTIONS` | `--max-old-space-size=350` | Keeps Node heap safely below Render Free Tier's 512 MB RAM ceiling. |
| `APP_URL` | `https://<your-render-service>.onrender.com` | Public URL of the backend service. |
| `PORTAL_MODE` | *(unset)* or `student` / `teacher` | Leave unset for unified access; set only if deploying two separate backend services. |
| `TEACHER_API_URL` | `https://<teacher-service>.onrender.com` | Used only in dual-backend mode so a separate Student backend syncs notes from a Teacher backend (aliases: `TEACHER_SERVICE_URL`, `TEACHER_URL`). |

### 3. Frontend Build Variables (Set in GitHub Actions Variables or Local `.env`)

Configure these in **GitHub Repository → Settings → Secrets and variables → Actions → Variables** (not Secrets, as Vite bakes `VITE_*` values into public client JS):

| Variable | Example / Default | Purpose |
|---|---|---|
| `VITE_BACKEND_URL` | `https://<your-render-service>.onrender.com` | Tells the static GitHub Pages frontend where to send `/api/*` requests (alias: `VITE_API_URL`). |
| `VITE_PORTAL_MODE` | *(unset)* or `student` / `teacher` | Optional: locks a static build to a single portal mode. Leave unset for `#/student` + `#/teacher` hash routing. |
| `VITE_STANDALONE` | *(unset)* or `true` | Optional: used with single-portal split deployments. |
| `VITE_STUDENT_BACKEND_URL` | `https://<student-service>.onrender.com` | Optional override for dual-website GitHub workflows (`.github/workflows/deploy-two-websites.yml`). |
| `VITE_TEACHER_BACKEND_URL` | `https://<teacher-service>.onrender.com` | Optional override for dual-website GitHub workflows. |

---

## Local Development Setup

**Prerequisites:** Node.js `>= 20.0.0` and npm.

1. **Clone the repository and install dependencies:**
   ```bash
   git clone <your-repo-url>
   cd <your-repo-folder>
   npm install
   ```

2. **Create your local `.env` file from `.env.example`:**
   ```bash
   cp .env.example .env
   ```
   Fill in your actual keys in `.env` (never wrap values with stray spaces, and make sure `.env` is listed in `.gitignore`):
   ```env
   GEMINI_API_KEY=your_google_ai_studio_key
   CHROMA_API_KEY=your_chroma_cloud_api_key
   CHROMA_TENANT=your_chroma_tenant_uuid
   CHROMA_DATABASE=rag-notes-application1
   CHROMA_COLLECTION=student_notes

   # Optional AI fallbacks
   OPENROUTER_API_KEY=
   GROQ_API_KEY=

   # Local / Production URLs
   APP_URL=http://localhost:3000
   VITE_BACKEND_URL=http://localhost:3000
   ```

3. **Run the development server (port 3000):**
   ```bash
   npm run dev
   ```
   Open:
   - Student view: `http://localhost:3000/#/student`
   - Teacher view: `http://localhost:3000/#/teacher`

4. **Type-check and build locally:**
   ```bash
   npm run lint
   npm run build
   ```

---

## Production Deployment Guide (GitHub Pages + Render)

This is the recommended free-tier architecture: **GitHub Pages** serves the fast static UI globally, while **Render** runs the Node.js API, document parsers, AI proxy, and ChromaDB Cloud sync.

### Step 1: Set Up ChromaDB Cloud (Persistent Note Storage)

Render Free Tier containers have an **ephemeral local disk** (files in `./data` are wiped whenever Render sleeps or redeploys). Connecting ChromaDB Cloud ensures teacher-uploaded notes are never lost and automatically re-hydrate into the backend on startup.

1. Sign in at [trychroma.com](https://www.trychroma.com/).
2. Create or select your database (e.g., `rag-notes-application1`).
3. Open **Connect** / **Settings** and copy:
   - **API Key** → `CHROMA_API_KEY`
   - **Tenant ID (UUID)** → `CHROMA_TENANT`
   - **Database Name** → `CHROMA_DATABASE` (e.g., `rag-notes-application1`)
   - **Collection Name** → `CHROMA_COLLECTION` (`student_notes`)

> **Important:** Make sure `CHROMA_API_KEY` belongs to the exact same Chroma organization/tenant as `CHROMA_TENANT`, otherwise ChromaDB Cloud will reject writes with `401 Unauthorized`.

---

### Step 2: Deploy the Backend on Render

1. Push your code to your GitHub repository (`main` branch).
2. Log in to [Render Dashboard](https://dashboard.render.com/) and click **New +** → **Web Service**.
3. Connect your GitHub repository and configure:
   - **Runtime:** `Node`
   - **Branch:** `main`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Health Check Path:** `/api/health`
   - **Instance Type:** `Free` (or Starter)
4. Go to the **Environment** section and add these keys (without extra quotes around values):
   - `NODE_ENV` = `production`
   - `NODE_OPTIONS` = `--max-old-space-size=350`
   - `GEMINI_API_KEY` = `<your-gemini-api-key>`
   - `CHROMA_API_KEY` = `<your-chroma-cloud-api-key>`
   - `CHROMA_TENANT` = `<your-chroma-tenant-uuid>`
   - `CHROMA_DATABASE` = `rag-notes-application1`
   - `CHROMA_COLLECTION` = `student_notes`
   - *(Optional)* `OPENROUTER_API_KEY` = `<your-openrouter-key>`
   - *(Optional)* `GROQ_API_KEY` = `<your-groq-key>`
5. Click **Create Web Service**.
6. Wait for the deploy to finish, then copy your Render URL (e.g., `https://student-notes-hub-2.onrender.com`) and verify it returns JSON at:
   ```text
   https://<your-render-service>.onrender.com/api/health
   ```

---

### Step 3: Deploy the Frontend to GitHub Pages

The repository includes automated workflows in `.github/workflows/static.yml` (and `deploy.yml`) that build the Vite app using `npm run build:gh-pages` and publish `./dist` to GitHub Pages.

1. Open your GitHub repository in a browser.
2. Go to **Settings** → **Pages**:
   - Under **Build and deployment → Source**, select **GitHub Actions** (not "Deploy from a branch").
3. Go to **Settings** → **Secrets and variables** → **Actions** → **Variables** tab:
   - Click **New repository variable**
   - **Name:** `VITE_BACKEND_URL`
   - **Value:** `https://<your-render-service>.onrender.com` *(no trailing slash)*
   - Click **Add variable**.
4. *(Check workflows)* Ensure only the workflow you want active triggers on `main` pushes (e.g., `.github/workflows/static.yml` uses `vars.VITE_BACKEND_URL`).
5. Trigger deployment by pushing to `main` (or clicking **Actions** → **Deploy static content to Pages** → **Run workflow**):
   ```bash
   git push origin main
   ```
6. Once the workflow finishes, share your live URLs:
   - **Students:** `https://<your-username>.github.io/<repo-name>/#/student`
   - **Teachers:** `https://<your-username>.github.io/<repo-name>/#/teacher`

---

## Alternative Deployment Options

- **Render Blueprint (Dual Teacher + Student Services):** Use `render.yaml` via **Render Dashboard → New + → Blueprint** to spin up separate Teacher and Student services automatically. See `DEPLOY_RENDER.md`.
- **Docker (Enables Server-Side PowerPoint `.pptx` Slide Rendering):** The included `Dockerfile` installs `libreoffice-impress`, `poppler-utils`, and `librsvg2-bin` so uploaded `.pptx` decks render to high-resolution slide images directly on the backend. In Render, switch **Runtime** to **Docker** to use `Dockerfile`.
- **Additional Guides in Repo:** See `DEPLOY_GITHUB_PAGES_AND_RENDER.md`, `DEPLOY_RENDER.md`, `DEPLOY_TWO_WEBSITES.md`, and `DEPLOY_HUGGINGFACE.md` for specialized setups.

---

## Verification & Troubleshooting

| Issue | Likely Cause | Fix |
|---|---|---|
| Notes upload in Teacher view, but `student_notes` is empty in ChromaDB Cloud | `CHROMA_API_KEY` doesn't match `CHROMA_TENANT` / `CHROMA_DATABASE` (401 Unauthorized) or Render env vars have extra quotes | Generate a fresh API key in ChromaDB Cloud under the target database/tenant, set `CHROMA_API_KEY`, `CHROMA_TENANT`, `CHROMA_DATABASE`, and `CHROMA_COLLECTION=student_notes` in Render **Environment** (no quotes), and click **Manual Deploy**. |
| First load takes 20–40 seconds on GitHub Pages | Render Free Tier spins down after 15 minutes of inactivity | Wait ~30 seconds for Render to wake up, or verify `https://<your-render-service>.onrender.com/api/health`. |
| Frontend talks to an old/wrong backend URL | Browser cached a previous URL in `localStorage` or `VITE_BACKEND_URL` changed | Click the **Server Connection** badge in the app header, enter your current Render URL, and click **Save & Test Connection**. |
| Google Drive / Docs / Slides import fails | Link sharing is set to **Restricted** | In Google Drive, set **General access** to **Anyone with the link (Viewer)** before importing. |
| AI Tutor returns missing-key error | No AI provider key configured on Render | Add `GEMINI_API_KEY` (and optionally `OPENROUTER_API_KEY` or `GROQ_API_KEY`) in Render **Environment** and redeploy. |

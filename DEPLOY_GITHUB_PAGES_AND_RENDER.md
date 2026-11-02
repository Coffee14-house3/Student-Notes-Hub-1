# 🚀 Split Architecture Deployment: GitHub Pages Frontend + Render Backend

This setup splits the workload between two platforms so **Render never gets overwhelmed by static file traffic** and runs at peak efficiency:

1. **GitHub Pages (Frontend)**:
   - Hosts the entire UI for both **Students** and **Faculty**.
   - Unlimited free bandwidth, global CDN caching, and 0ms load times.
   - **Direct Student Link:** `https://<username>.github.io/<repo-name>/#/student`
   - **Direct Faculty Link:** `https://<username>.github.io/<repo-name>/#/faculty`

2. **Render (Backend Microservice)**:
   - Runs the Node.js backend (<80MB RAM).
   - Handles Google Drive fetching, document tokenization & parsing (`pdf-parse`, `mammoth`), vector database indexing, and Gemini AI queries (`/api/chat`, `/api/generate-quiz`).
   - Completely freed from serving HTML, CSS, JavaScript, or images to 16+ students.

---

## 📐 System Architecture

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │                         GITHUB PAGES (STATIC CDN)                      │
 │                     https://<username>.github.io/<repo>/               │
 └───────────────────┬────────────────────────────────┬───────────────────┘
                     │                                │
         Direct Link │                    Direct Link │
                     ▼                                ▼
 ┌───────────────────────────────────┐┌───────────────────────────────────┐
 │       STUDENT PORTAL (#/student)  ││       FACULTY STUDIO (#/faculty)  │
 │                                   ││                                   │
 │ - 16+ Concurrent MCA Students     ││ - Google Drive / Docs Importer    │
 │ - Zero Teacher / Admin Controls   ││ - ChromaDB Semantic Indexer       │
 │ - Instant 0ms Slide / PDF Reader  ││ - Announcement Publisher          │
 │ - AI Smart Tutor & Practice Quiz  ││ - Syllabus & Note Manager         │
 └─────────────────┬─────────────────┘└─────────────────┬─────────────────┘
                   │                                    │
                   │  CORS JSON API Calls (/api/*)      │
                   └─────────────────┬──────────────────┘
                                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                    RENDER.COM BACKEND MICROSERVICE                     │
 │                 https://<your-service>.onrender.com                    │
 │                                                                        │
 │   - Lightweight Node.js Server (<80MB memory footprint)                │
 │   - Google Drive API Fetcher & Tokenizer                               │
 │   - Persistent Notes Store (data/documents.json)                       │
 │   - Gemini AI Proxy & RAG Search (/api/chat)                           │
 │   - Instant Health Ping (/api/health, <5ms)                            │
 └────────────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Step-by-Step Deployment Guide

### STEP 1: Deploy Backend Microservice on Render

1. Log in to [Render.com](https://render.com).
2. Click **New +** ➔ **Web Service**.
3. Select your GitHub repository (`aws-cloud-notes-reader` or your project name).
4. Configure the service settings:
   - **Name:** `aws-cloud-notes-api` (or any name you prefer)
   - **Environment:** `Node`
   - **Region:** Any (e.g., `Oregon` or `Frankfurt`)
   - **Branch:** `main`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Plan:** `Free`
5. Under **Environment Variables**, add:
   - `NODE_ENV`: `production`
   - `GEMINI_API_KEY`: `<Your Gemini API Key>` (e.g. your key from Google AI Studio)
6. Click **Deploy Web Service**.
7. Once deployed, copy your Render service URL (e.g., `https://aws-cloud-notes-api.onrender.com`).

---

### STEP 2: Configure GitHub Pages (Automated GitHub Actions)

Your repository already contains the automated workflow at `.github/workflows/deploy-github-pages.yml`.

1. Go to your GitHub repository in your browser.
2. Navigate to **Settings** ➔ **Pages** (in the left sidebar).
3. Under **Build and deployment** ➔ **Source**, select **GitHub Actions** (do NOT choose "Deploy from a branch").
4. (Recommended) Set your Render Backend URL as a repository variable so GitHub Pages connects to it automatically:
   - Go to **Settings** ➔ **Secrets and variables** ➔ **Actions**.
   - Under the **Variables** tab, click **New repository variable**.
   - **Name:** `VITE_BACKEND_URL`
   - **Value:** `https://aws-cloud-notes-api.onrender.com` (replace with your Render URL from Step 1).
   - Click **Add variable**.

---

### STEP 3: Push and Verify

1. Push your latest code to GitHub:
   ```bash
   git add .
   git commit -m "Configure GitHub Pages hash routing and Render backend split"
   git push origin main
   ```
2. In GitHub, go to the **Actions** tab to watch the workflow build and deploy.
3. Once complete, your direct links are live:
   - 🎓 **Student Direct Link:** `https://<username>.github.io/<repo>/#/student`
   - 👩‍🏫 **Faculty Direct Link:** `https://<username>.github.io/<repo>/#/faculty`

---

## ⚡ In-App Connection Fallback

If you ever change your Render URL or test different environments:
1. Open either the Student or Faculty portal.
2. Click the **Server Connection** button in the header bar.
3. Paste your Render backend URL and click **Save & Test Connection**.
4. The app tests latency immediately (`/api/health`) and saves it to the browser for instant reconnection.

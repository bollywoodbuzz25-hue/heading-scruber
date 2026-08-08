# Competitor Heading Scraper

A two-part tool for pulling H1–H4 headings from competitor blog posts, for SEO content briefs. Built as a **separate frontend and backend** because Blogger can't run server-side code or hide API keys — the browser can't safely call a SERP API or scrape other domains itself (CORS + key exposure), so a small backend does that work and the Blogger page just talks to it.

```
Blogger page (frontend/index.html)
        │  fetch() calls, no keys in this file
        ▼
Your backend (backend/) — Node.js + Express
        │
        ├── /api/serp     → Serper.dev (SERP results) → filters to top 5 blog/article URLs
        └── /api/scrape   → fetches a URL → parses HTML → extracts H1–H4 in page order
```

## What's included

- `backend/` — Express API with two endpoints (`/api/serp`, `/api/scrape` / `/api/scrape-batch`), SSRF protection, rate limiting, and timeout/size limits.
- `frontend/index.html` — a single self-contained HTML/CSS/JS file you paste into a Blogger HTML/JavaScript gadget.

## 1. Get a SERP API key

The backend uses [Serper.dev](https://serper.dev) for Google search results (simple REST API, free tier available). Sign up and copy your API key. (If you'd rather use SerpApi or another provider, swap the implementation in `backend/utils/serp.js` — the rest of the app doesn't care which provider you use.)

## 2. Run the backend locally

```bash
cd backend
npm install
cp .env.example .env
# edit .env: paste your SERPER_API_KEY, and set ALLOWED_ORIGINS to your Blogger URL
npm start
```

The server starts on `http://localhost:8787` by default. Test it:

```bash
curl http://localhost:8787/api/health
# {"ok":true}
```

## 3. Deploy the backend

This is a plain Node/Express app, so it runs on any Node host. A few easy options:

- **Render** — "New Web Service" → connect the repo → build command `npm install` → start command `npm start` → add your `.env` values as environment variables in the dashboard.
- **Railway** — similar flow: new project from repo, set environment variables, deploy.
- **A VPS** (e.g. with pm2 or systemd) if you prefer to manage it yourself.

Whichever you use, set the same environment variables from `.env.example` in that platform's dashboard — **never commit your real `.env` file**, and never put `SERPER_API_KEY` in the frontend.

Once deployed, note your backend's public URL (e.g. `https://heading-scraper-api.onrender.com`).

## 4. Configure and publish the frontend on Blogger

1. Open `frontend/index.html` and change this line near the top of the `<script>` block:
   ```js
   var BACKEND_URL = "https://YOUR-BACKEND-DOMAIN.example.com";
   ```
   to your deployed backend's URL (no trailing slash).
2. In Blogger: **Layout → Add a Gadget → HTML/JavaScript**.
3. Paste the entire contents of `frontend/index.html` into the gadget's content box and save.
4. Publish the page and test both tabs.

## 5. Lock down CORS

In your backend's `.env`, set `ALLOWED_ORIGINS` to your actual Blogger domain(s), comma-separated, e.g.:

```
ALLOWED_ORIGINS=https://yourblog.blogspot.com,https://www.youryourdomain.com
```

Requests from any other origin will be rejected by the backend.

## Notes on behavior

- Headings are extracted **exactly as they appear** on the page, in the original DOM order — nothing is reworded, reordered, or invented. If a level has no headings, the tool shows "No H3 headings found" rather than fabricating content.
- The SERP filter drops ads, images, videos, shopping, social media, forums, category/tag pages, and homepages, keeping up to 5 organic article/blog results.
- Pages that need JavaScript to render their content (rare for most blog platforms, including WordPress/Blogger themselves) won't have their headings picked up by the default fetch-based scraper — the tool will say so rather than guessing. `backend/.env.example` has a placeholder (`RENDER_API_KEY`) if you later want to wire in a headless-rendering provider for those cases.
- Security: the backend validates and re-checks every URL (including after redirects) to block requests to localhost and private IP ranges, enforces request timeouts and response-size caps, and rate-limits both the SERP and scrape endpoints.

## Costs to expect

- Serper.dev: free tier covers light use; paid tiers are usage-based.
- Hosting: Render/Railway free tiers work for testing; a small paid instance is more reliable for regular use (free tiers often sleep when idle, adding a delay to the first request).

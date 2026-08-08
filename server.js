require("dotenv").config();
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const { findTopCompetitors, COUNTRY_CODES } = require("./utils/serp");
const { scrapeOne } = require("./utils/scrape");
const { MAX_URL_LENGTH } = require("./utils/urlSafety");

const app = express();
app.use(express.json({ limit: "50kb" }));

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Allow same-origin/non-browser requests (no Origin header) and any
      // origin explicitly listed in ALLOWED_ORIGINS.
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
  })
);

// Blanket rate limit for the whole API, plus a stricter one on scraping
// (which is the more expensive/abusable operation).
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests. Please try again shortly." },
  })
);

const scrapeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many scrape requests. Please slow down." },
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/api/countries", (req, res) => {
  res.json({ countries: Object.keys(COUNTRY_CODES) });
});

app.post("/api/serp", async (req, res) => {
  try {
    const { keyword, country } = req.body || {};
    if (!keyword || typeof keyword !== "string" || !keyword.trim()) {
      return res.status(400).json({ error: "Please enter a keyword." });
    }
    if (!country || typeof country !== "string" || !COUNTRY_CODES[country]) {
      return res.status(400).json({ error: "Please select a country." });
    }
    const results = await findTopCompetitors(keyword.trim().slice(0, 200), country);
    res.json({ results });
  } catch (err) {
    res.status(200).json({ error: err.message || "No suitable blog results found." });
  }
});

app.post("/api/scrape", scrapeLimiter, async (req, res) => {
  try {
    const { url } = req.body || {};
    if (!url || typeof url !== "string" || url.length > MAX_URL_LENGTH) {
      return res.status(400).json({ error: "This URL could not be scraped." });
    }
    const result = await scrapeOne(url.trim());
    res.json(result);
  } catch (err) {
    res.status(200).json({ error: err.message || "This URL could not be scraped.", url: req.body?.url });
  }
});

app.post("/api/scrape-batch", scrapeLimiter, async (req, res) => {
  try {
    const { urls } = req.body || {};
    if (!Array.isArray(urls) || urls.length === 0 || urls.length > 5) {
      return res.status(400).json({ error: "Provide between 1 and 5 URLs." });
    }
    // Scrape sequentially (not in parallel) to stay polite to target sites
    // and to keep this endpoint's resource use predictable under load.
    const results = [];
    for (const rawUrl of urls) {
      if (!rawUrl || typeof rawUrl !== "string") {
        results.push({ error: "This URL could not be scraped.", url: rawUrl });
        continue;
      }
      try {
        const result = await scrapeOne(rawUrl.trim());
        results.push({ url: rawUrl.trim(), ...result });
      } catch (err) {
        results.push({ url: rawUrl.trim(), error: err.message || "This URL could not be scraped." });
      }
    }
    res.json({ results });
  } catch {
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

// Generic fallback — never leak internal error details to the client.
app.use((err, req, res, next) => {
  if (err && err.message === "Not allowed by CORS") {
    return res.status(403).json({ error: "This origin is not permitted." });
  }
  res.status(500).json({ error: "Something went wrong. Please try again." });
});

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => {
  console.log(`Heading Scraper backend running on port ${PORT}`);
});

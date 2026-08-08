const axios = require("axios");

// Maps the dropdown's country choice to Serper.dev's "gl" (geolocation) code.
// Extend this list freely — Serper accepts standard two-letter country codes.
const COUNTRY_CODES = {
  india: "in",
  usa: "us",
  uk: "gb",
  canada: "ca",
  australia: "au",
  uae: "ae",
  singapore: "sg",
  germany: "de",
  france: "fr",
  malaysia: "my",
  philippines: "ph",
  south_africa: "za",
};

const SOCIAL_AND_NON_BLOG_DOMAINS = [
  "youtube.com",
  "youtu.be",
  "facebook.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "linkedin.com",
  "pinterest.",
  "tiktok.com",
  "reddit.com",
  "quora.com",
  "amazon.",
  "amazon.in",
  "flipkart.com",
  "ebay.",
  "wikipedia.org",
  "play.google.com",
  "apps.apple.com",
];

const NON_ARTICLE_PATH_HINTS = [
  "/category/",
  "/categories/",
  "/tag/",
  "/tags/",
  "/shop/",
  "/product/",
  "/products/",
  "/cart",
  "/checkout",
  "/login",
  "/signup",
  "/search",
];

function looksLikeHomepage(url) {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, "");
    return path === "" || path === "/";
  } catch {
    return true;
  }
}

function isLikelyBlogArticle(result) {
  const url = (result.link || "").toLowerCase();
  if (!url) return false;
  if (SOCIAL_AND_NON_BLOG_DOMAINS.some((d) => url.includes(d))) return false;
  if (NON_ARTICLE_PATH_HINTS.some((p) => url.includes(p))) return false;
  if (looksLikeHomepage(url)) return false;
  return true;
}

/**
 * Looks up the top organic results for a keyword/country and returns up to
 * 5 that look like real blog/article pages (never ads, images, videos,
 * shopping, social, forums, category pages, or homepages).
 */
async function findTopCompetitors(keyword, country) {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) {
    throw new Error("Search is temporarily unavailable.");
  }

  const gl = COUNTRY_CODES[country] || "in";

  let response;
  try {
    response = await axios.post(
      "https://google.serper.dev/search",
      { q: keyword, gl, num: 20 },
      {
        headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
        timeout: 10000,
      }
    );
  } catch {
    throw new Error("No suitable blog results found.");
  }

  const organic = Array.isArray(response.data?.organic)
    ? response.data.organic
    : [];

  const filtered = organic.filter(isLikelyBlogArticle).slice(0, 5);

  if (filtered.length === 0) {
    throw new Error("No suitable blog results found.");
  }

  return filtered.map((r, i) => ({
    position: i + 1,
    title: r.title || r.link,
    url: r.link,
  }));
}

module.exports = { findTopCompetitors, COUNTRY_CODES };

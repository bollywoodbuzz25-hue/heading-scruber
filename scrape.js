const axios = require("axios");
const { assertSafeUrl } = require("./urlSafety");
const { extractHeadings } = require("./extractHeadings");

const TIMEOUT_MS = Number(process.env.SCRAPE_TIMEOUT_MS || 10000);
const MAX_BYTES = Number(process.env.MAX_RESPONSE_BYTES || 3_000_000);

/**
 * Fetches a single URL and returns { title, headings, finalUrl }.
 * Throws a short, user-safe Error message on any failure — never leaks
 * stack traces or provider-specific error text to the caller.
 */
async function scrapeOne(rawUrl) {
  const safeUrl = await assertSafeUrl(rawUrl); // throws if unsafe

  let response;
  try {
    response = await axios.get(safeUrl.toString(), {
      timeout: TIMEOUT_MS,
      maxContentLength: MAX_BYTES,
      maxBodyLength: MAX_BYTES,
      maxRedirects: 5,
      responseType: "text",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; HeadingScraperBot/1.0; +https://example.com/bot)",
        Accept: "text/html,application/xhtml+xml",
      },
      // Re-validate the final URL after redirects to block redirect-based SSRF.
      validateStatus: (status) => status >= 200 && status < 400,
    });
  } catch (err) {
    if (err.code === "ECONNABORTED") {
      throw new Error("Unable to access this webpage.");
    }
    throw new Error("Unable to access this webpage.");
  }

  const finalUrl = response.request?.res?.responseUrl || safeUrl.toString();
  if (finalUrl !== safeUrl.toString()) {
    await assertSafeUrl(finalUrl); // guard against redirect to a private IP
  }

  const contentType = response.headers["content-type"] || "";
  if (!contentType.includes("html") && !contentType.includes("text")) {
    throw new Error("This URL could not be scraped.");
  }

  const { title, headings } = extractHeadings(response.data);

  if (headings.length === 0) {
    // Likely a JS-rendered page. We deliberately do not fabricate headings —
    // surface this clearly instead. Wire in RENDER_API_KEY here if you add
    // a headless-rendering provider (see .env.example).
    throw new Error(
      "This page's headings could not be read (it may require JavaScript to render)."
    );
  }

  return { title, headings, finalUrl };
}

module.exports = { scrapeOne };

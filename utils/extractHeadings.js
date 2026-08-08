const cheerio = require("cheerio");
const he = require("he");

/**
 * Extracts H1–H4 headings from raw HTML, in DOM order, exactly as they
 * appear on the page. No rewriting, no reordering, no invented content.
 */
function extractHeadings(html) {
  const $ = cheerio.load(html);

  // Drop obviously non-content areas so nav/footer boilerplate headings
  // (e.g. "Related Posts", "Subscribe") don't drown out the article itself.
  // This only removes elements — it never adds or edits heading text.
  $("script, style, noscript").remove();

  const headings = [];
  $("h1, h2, h3, h4").each((_, el) => {
    const tag = el.tagName ? el.tagName.toLowerCase() : el.name;
    const rawText = $(el).text();
    const decoded = he.decode(rawText);
    const text = decoded.replace(/\s+/g, " ").trim();
    if (text.length === 0) return; // remove empty headings
    headings.push({ level: tag, text });
  });

  // Remove exact, consecutive duplicates only (common with theme markup that
  // renders the same heading twice, e.g. for mobile/desktop). We deliberately
  // do NOT dedupe non-adjacent repeats — those may be legitimate (e.g. a
  // recurring "FAQ" subheading under different sections) and removing them
  // would misrepresent the page's real structure.
  const deduped = [];
  for (const h of headings) {
    const prev = deduped[deduped.length - 1];
    if (prev && prev.level === h.level && prev.text === h.text) continue;
    deduped.push(h);
  }

  const pageTitle = $("title").first().text().trim() || null;

  return { title: pageTitle, headings: deduped };
}

/** Builds the indented hierarchy view used by the frontend and copy output. */
function formatHeadingsAsText(pageTitle, headings, label) {
  const lines = [];
  if (label) lines.push(label);
  if (pageTitle) lines.push(pageTitle);
  lines.push("");

  const h1s = headings.filter((h) => h.level === "h1");
  if (h1s.length === 0) {
    lines.push("No H1 headings found");
  }

  for (const h of headings) {
    const indent = { h1: "", h2: "", h3: "    ", h4: "        " }[h.level] || "";
    const tag = h.level.toUpperCase();
    lines.push(`${indent}${tag}: ${h.text}`);
  }

  for (const level of ["h2", "h3", "h4"]) {
    if (!headings.some((h) => h.level === level)) {
      lines.push(`No ${level.toUpperCase()} headings found`);
    }
  }

  return lines.join("\n");
}

module.exports = { extractHeadings, formatHeadingsAsText };

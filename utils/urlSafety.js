const dns = require("dns").promises;
const net = require("net");
const { URL } = require("url");

const MAX_URL_LENGTH = 2048;

// Private / reserved / loopback / link-local ranges we must never let the
// scraper reach, including IPv6 equivalents. This blocks both literal IPs
// in the input AND the resolved IP after DNS lookup (to stop DNS rebinding).
function isDisallowedIPv4(ip) {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
  const [a, b] = parts;
  if (a === 127) return true; // loopback
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 169 && b === 254) return true; // link-local
  if (a === 0) return true; // "this" network
  if (a >= 224) return true; // multicast/reserved
  return false;
}

function isDisallowedIPv6(ip) {
  const lower = ip.toLowerCase();
  if (lower === "::1") return true; // loopback
  if (lower.startsWith("fe80:")) return true; // link-local
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique local (fc00::/7)
  if (lower.startsWith("::ffff:")) {
    // IPv4-mapped IPv6 — check the embedded IPv4 part too
    const mapped = lower.split(":").pop();
    if (net.isIPv4(mapped)) return isDisallowedIPv4(mapped);
  }
  return false;
}

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal", // cloud metadata endpoints
  "169.254.169.254",
]);

/**
 * Validates a user-supplied URL for safety and returns the parsed URL if OK.
 * Throws an Error with a short, user-safe message on failure.
 */
async function assertSafeUrl(rawUrl) {
  if (typeof rawUrl !== "string" || rawUrl.trim().length === 0) {
    throw new Error("This URL could not be scraped.");
  }
  if (rawUrl.length > MAX_URL_LENGTH) {
    throw new Error("This URL could not be scraped.");
  }

  let parsed;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error("This URL could not be scraped.");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("This URL could not be scraped.");
  }

  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new Error("This URL could not be scraped.");
  }

  // If the hostname is itself a literal IP, check it directly.
  if (net.isIPv4(hostname) && isDisallowedIPv4(hostname)) {
    throw new Error("This URL could not be scraped.");
  }
  if (net.isIPv6(hostname) && isDisallowedIPv6(hostname)) {
    throw new Error("This URL could not be scraped.");
  }

  // Resolve DNS and check every returned address (defends against DNS
  // rebinding, where a hostname resolves to a private IP at fetch time).
  let addresses;
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch {
    throw new Error("Unable to access this webpage.");
  }

  for (const { address, family } of addresses) {
    if (family === 4 && isDisallowedIPv4(address)) {
      throw new Error("This URL could not be scraped.");
    }
    if (family === 6 && isDisallowedIPv6(address)) {
      throw new Error("This URL could not be scraped.");
    }
  }

  return parsed;
}

module.exports = { assertSafeUrl, MAX_URL_LENGTH };

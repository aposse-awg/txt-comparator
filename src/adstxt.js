export function parseAdsTxt(raw) {
  const lines = raw.split("\n");
  const entries = new Set();
  const duplicates = new Set();
  const directives = [];
  const seen = [];

  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const noComment = trimmed.split("#")[0].trim();
    if (!noComment) continue;

    if (/^(inventorypartnerdomain|ownerdomain|managerdomain|subdomain)=/i.test(noComment)) {
      directives.push(noComment.toLowerCase());
      continue;
    }

    const normalized = noComment
      .toLowerCase()
      .replace(/\s*,\s*/g, ", ")
      .replace(/\s+/g, " ")
      .trim();
    if (!normalized) continue;

    if (entries.has(normalized)) {
      duplicates.add(normalized);
    } else {
      entries.add(normalized);
    }
    seen.push(normalized);
  }

  return { entries, duplicates, directives, total: seen.length };
}

export function getDomain(entry) {
  return entry.split(",")[0].trim();
}

// Accepts domains one per line (or separated by commas / spaces), with or
// without protocol or path, e.g. "https://www.site.com/ads.txt" -> "www.site.com".
export function parseDomainList(raw) {
  const domains = raw
    .split(/[\s,;]+/)
    .map(d => d
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .split("/")[0]
      .split(":")[0]
      .replace(/\.$/, ""))
    .filter(Boolean);
  return [...new Set(domains)];
}

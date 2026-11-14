import { readFile, writeFile } from "node:fs/promises";

const tracker = new URL("./private/applications.md", import.meta.url);
const template = new URL("./dashboard.template.html", import.meta.url);
const dashboard = new URL("./dashboard.html", import.meta.url);
const [markdown, html] = await Promise.all([
  readFile(tracker, "utf8"),
  readFile(template, "utf8"),
]);
const sections = markdown.split(/^## /m);
const summary = sections.shift();
const timelines = new Map(sections.map(section => {
  const [heading, ...lines] = section.trim().split(/\r?\n/);
  return [heading, lines];
}));
const seen = new Set();
const records = [];
for (const row of summary.matchAll(/^\| (.+?) \| (.+?) \| (.+?) \|\r?$/gm)) {
  const [, company, role, stage] = row;
  const lines = timelines.get(company + " · " + role);
  if (!lines) continue;
  const events = [];
  for (const line of lines) {
    const match = line.match(/^- (\d{4}-\d{2}-\d{2}) · ([^·]+?) · \[Gmail\]\((https:\/\/mail\.google\.com\/[^)]+)\) <!-- gmail-message: ([\w-]+) -->$/);
    if (!match) continue;
    const [, date, eventStage, url, id] = match;
    if (seen.has(id)) continue;
    seen.add(id);
    events.push({ id, date, stage: eventStage, url });
  }
  events.sort((a, b) => b.date.localeCompare(a.date));
  records.push({ company, role, stage, events });
}
const dataLine = /^const records=.*;\r?$/m;
if (!records.length || !dataLine.test(html)) throw new Error("Tracker or dashboard format could not be read.");
const json = JSON.stringify(records).replace(/</g, "\\u003c");
const coverage = summary.match(/^Gmail sync (.+?)\. Search phrases/m)?.[1];
const next = html.replace(dataLine, () => "const records=" + json + ";")
  .replace("Local application tracker", () => "Gmail snapshot" + (coverage ? " · " + coverage.replace(/[<>&]/g, "") : ""));
if (next !== html) await writeFile(dashboard, next, "utf8");
console.log(`Dashboard contains ${records.length} applications and ${seen.size} unique Gmail events.`);

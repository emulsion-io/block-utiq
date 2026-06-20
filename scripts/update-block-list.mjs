import { readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

const projectRoot = resolve(".");
const blockListPath = resolve(projectRoot, "block.json");
const sourceArg = process.argv[2];

if (!sourceArg) {
  console.error("Usage: node scripts/update-block-list.mjs <source-json>");
  process.exit(1);
}

const sourcePath = resolve(projectRoot, sourceArg);
const source = JSON.parse(await readFile(sourcePath, "utf8"));
const domains = extractDomains(source);

await writeFile(blockListPath, `${JSON.stringify({ blocked: domains }, null, 2)}\n`);

console.log(`block.json mis a jour depuis ${basename(sourcePath)} avec ${domains.length} domaines.`);

function extractDomains(input) {
  if (!input || !Array.isArray(input.sites)) {
    throw new Error("Le fichier source doit contenir une propriete sites de type tableau.");
  }

  const domains = input.sites
    .map((site) => site?.domain)
    .map((domain) => String(domain ?? "").trim().toLowerCase())
    .filter(Boolean)
    .map((domain) => domain.replace(/^https?:\/\//, "").replace(/\/.*$/, ""));

  return [...new Set(domains)];
}
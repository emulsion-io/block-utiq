import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

const projectRoot = resolve(".");
const blockListPath = resolve(projectRoot, "block.json");
const configPath = resolve(projectRoot, "extension.config.json");
const packagePath = resolve(projectRoot, "package.json");
const srcDir = resolve(projectRoot, "src");
const distDir = resolve(projectRoot, "dist");

const blockList = JSON.parse(await readFile(blockListPath, "utf8"));
const extensionConfig = JSON.parse(await readFile(configPath, "utf8"));
const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
const domains = normalizeDomains(blockList.blocked);

for (const browser of ["chrome", "firefox"]) {
  const outDir = resolve(distDir, browser);
  await mkdir(outDir, { recursive: true });
  await cp(resolve(srcDir, "background"), resolve(outDir, "background"), { recursive: true });
  await cp(resolve(srcDir, "blocked"), resolve(outDir, "blocked"), { recursive: true });
  await cp(resolve(srcDir, "icons"), resolve(outDir, "icons"), { recursive: true });
  await writeFile(resolve(outDir, "block.json"), `${JSON.stringify({ blocked: domains }, null, 2)}\n`);
  await writeFile(resolve(outDir, "manifest.json"), `${JSON.stringify(createManifest(browser, packageJson, extensionConfig), null, 2)}\n`);
}

console.log(`Extensions generees dans ${basename(distDir)}/chrome et ${basename(distDir)}/firefox.`);

function normalizeDomains(input) {
  if (!Array.isArray(input)) {
    throw new Error("block.json doit contenir une propriete blocked de type tableau.");
  }

  const domains = input
    .map((domain) => String(domain).trim().toLowerCase())
    .filter(Boolean)
    .map((domain) => domain.replace(/^https?:\/\//, "").replace(/\/.*$/, ""))
    .filter((domain) => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain));

  return [...new Set(domains)].sort();
}

function createManifest(browser, packageJson, config) {
  const common = {
    name: config.name,
    short_name: config.shortName,
    version: packageJson.version,
    description: config.description,
    icons: config.icons
  };

  if (browser === "firefox") {
    return {
      manifest_version: 2,
      ...common,
      browser_action: {
        default_title: config.actionTitle
      },
      permissions: ["alarms", "storage", "tabs", "webNavigation", "http://*/*", "https://*/*"],
      background: {
        scripts: ["background/service-worker.js"],
        persistent: false
      },
      web_accessible_resources: config.blockedPageResources,
      browser_specific_settings: {
        gecko: {
          id: config.gecko.id,
          strict_min_version: config.gecko.strictMinVersion
        }
      }
    };
  }

  return {
    manifest_version: 3,
    ...common,
    action: {
      default_title: config.actionTitle
    },
    permissions: ["alarms", "storage", "tabs", "webNavigation"],
    host_permissions: ["http://*/*", "https://*/*"],
    background: {
      service_worker: "background/service-worker.js"
    },
    web_accessible_resources: [
      {
        resources: config.blockedPageResources,
        matches: ["<all_urls>"]
      }
    ]
  };
}

const REMOTE_BLOCKLIST_URL = "https://raw.githubusercontent.com/emulsion-io/block-utiq/main/block.json";
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const CACHE_DOMAINS_KEY = "blocklist:domains";
const CACHE_UPDATED_AT_KEY = "blocklist:updatedAt";

const api = globalThis.browser ?? globalThis.chrome;
let cachedDomains = new Set();
let cacheReady = loadCachedBlocklist();

api.runtime.onInstalled.addListener(() => {
  scheduleBlocklistRefresh();
  refreshBlocklist();
});

api.runtime.onStartup.addListener(() => {
  scheduleBlocklistRefresh();
  refreshBlocklistIfStale();
});

api.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "refresh-blocklist") {
    refreshBlocklistIfStale();
  }
});

api.webNavigation.onBeforeNavigate.addListener((details) => {
  if (details.frameId !== 0 || details.tabId < 0) {
    return;
  }

  handleNavigation(details);
});

scheduleBlocklistRefresh();
refreshBlocklistIfStale();

async function handleNavigation(details) {
  await cacheReady;

  let url;

  try {
    url = new URL(details.url);
  } catch {
    return;
  }

  if (!["http:", "https:"].includes(url.protocol) || !isBlockedHost(url.hostname)) {
    return;
  }

  const bypassKey = await findBypassKey(url.hostname);
  const bypassUntil = bypassKey ? Number(await storageGet(bypassKey)) : 0;

  if (bypassUntil > Date.now()) {
    return;
  }

  const blockedPage = new URL(api.runtime.getURL("blocked/blocked.html"));
  blockedPage.searchParams.set("url", details.url);
  blockedPage.searchParams.set("host", url.hostname);

  try {
    await tabsUpdate(details.tabId, { url: blockedPage.href });
  } catch {
    // The tab may have disappeared between the navigation event and the update.
  }
}

function isBlockedHost(hostname) {
  const host = hostname.toLowerCase();

  if (cachedDomains.has(host)) {
    return true;
  }

  return [...cachedDomains].some((domain) => host.endsWith(`.${domain}`));
}

async function findBypassKey(hostname) {
  const host = hostname.toLowerCase();
  const candidates = [`allow-host:${host}`];

  for (const domain of cachedDomains) {
    if (host === domain || host.endsWith(`.${domain}`)) {
      candidates.push(`allow-host:${domain}`);
    }
  }

  for (const key of candidates) {
    const bypassUntil = Number(await storageGet(key));

    if (bypassUntil > Date.now()) {
      return key;
    }

    if (bypassUntil > 0) {
      await storageRemove(key);
    }
  }

  return null;
}

async function refreshBlocklistIfStale() {
  const updatedAt = Number(await storageGet(CACHE_UPDATED_AT_KEY));

  if (!updatedAt || Date.now() - updatedAt >= CACHE_MAX_AGE_MS) {
    await refreshBlocklist();
  }
}

async function refreshBlocklist() {
  try {
    const response = await fetch(REMOTE_BLOCKLIST_URL, { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const blocklist = await response.json();
    const domains = normalizeDomains(blocklist.blocked);

    if (domains.length === 0) {
      throw new Error("Remote blocklist is empty");
    }

    cachedDomains = new Set(domains);
    await storageSet({
      [CACHE_DOMAINS_KEY]: domains,
      [CACHE_UPDATED_AT_KEY]: Date.now()
    });
  } catch {
    await loadCachedBlocklist();
  }
}

async function loadCachedBlocklist() {
  const cached = await storageGet(CACHE_DOMAINS_KEY);

  if (Array.isArray(cached) && cached.length > 0) {
    cachedDomains = new Set(normalizeDomains(cached));
    return;
  }

  try {
    const response = await fetch(api.runtime.getURL("block.json"));
    const blocklist = await response.json();
    cachedDomains = new Set(normalizeDomains(blocklist.blocked));
  } catch {
    cachedDomains = new Set();
  }
}

function scheduleBlocklistRefresh() {
  api.alarms.create("refresh-blocklist", {
    periodInMinutes: 24 * 60
  });
}

function normalizeDomains(input) {
  if (!Array.isArray(input)) {
    return [];
  }

  const domains = input
    .map((domain) => String(domain).trim().toLowerCase())
    .filter(Boolean)
    .map((domain) => domain.replace(/^https?:\/\//, "").replace(/\/.*$/, ""))
    .filter((domain) => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain));

  return [...new Set(domains)].sort();
}

function storageGet(key) {
  if (globalThis.browser?.storage?.local) {
    return globalThis.browser.storage.local.get(key).then((items) => items?.[key], () => undefined);
  }

  return new Promise((resolve) => {
    const result = api.storage.local.get(key, (items) => resolve(items?.[key]));

    if (result?.then) {
      result.then((items) => resolve(items?.[key]), () => resolve(undefined));
    }
  });
}

function storageSet(value) {
  if (globalThis.browser?.storage?.local) {
    return globalThis.browser.storage.local.set(value).catch(() => undefined);
  }

  return new Promise((resolve) => {
    const result = api.storage.local.set(value, resolve);

    if (result?.then) {
      result.then(resolve, resolve);
    }
  });
}

function storageRemove(key) {
  if (globalThis.browser?.storage?.local) {
    return globalThis.browser.storage.local.remove(key).catch(() => undefined);
  }

  return new Promise((resolve) => {
    const result = api.storage.local.remove(key, resolve);

    if (result?.then) {
      result.then(resolve, resolve);
    }
  });
}

function tabsUpdate(tabId, properties) {
  if (globalThis.browser?.tabs) {
    return globalThis.browser.tabs.update(tabId, properties);
  }

  return new Promise((resolve, reject) => {
    const result = api.tabs.update(tabId, properties, (tab) => {
      const error = api.runtime.lastError;

      if (error) {
        reject(error);
        return;
      }

      resolve(tab);
    });

    if (result?.then) {
      result.then(resolve, reject);
    }
  });
}

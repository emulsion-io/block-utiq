const params = new URLSearchParams(window.location.search);
const originalUrl = params.get("url") || "";
const host = params.get("host") || "";

const hostNode = document.querySelector("#blocked-host");
const urlNode = document.querySelector("#blocked-url");
const continueLink = document.querySelector("#continue-link");

if (host) {
  hostNode.textContent = host;
}

if (originalUrl) {
  urlNode.textContent = originalUrl;
  urlNode.href = originalUrl;
  continueLink.href = originalUrl;
} else {
  urlNode.removeAttribute("href");
  continueLink.hidden = true;
}

continueLink.addEventListener("click", async (event) => {
  if (!originalUrl) {
    return;
  }

  event.preventDefault();
  const storage = globalThis.browser?.storage?.local ?? globalThis.chrome?.storage?.local;
  const bypassHost = host || new URL(originalUrl).hostname;
  const bypassUntil = Date.now() + 30000;

  if (storage) {
    await setStorageValue(storage, createBypassValue(bypassHost, bypassUntil));
  }

  window.location.href = originalUrl;
});

function createBypassValue(hostname, bypassUntil) {
  const host = hostname.toLowerCase();
  const value = {
    [`allow-host:${host}`]: bypassUntil
  };

  if (host.startsWith("www.")) {
    value[`allow-host:${host.slice(4)}`] = bypassUntil;
  }

  return value;
}

function setStorageValue(storage, value) {
  if (globalThis.browser?.storage?.local) {
    return globalThis.browser.storage.local.set(value).catch(() => undefined);
  }

  return new Promise((resolve) => {
    try {
      const result = storage.set(value, resolve);

      if (result?.then) {
        result.then(resolve, resolve);
      }
    } catch {
      resolve();
    }
  });
}

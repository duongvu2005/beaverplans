// App-shell caching and the reload that follows a new worker taking over.

const CACHE = 'shell-v1';
const SHELL = '/';
const NETWORK_TIMEOUT_MS = 4000;
const MATCH = { ignoreVary: true };

self.addEventListener('install', (event) => {
    event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        self.caches
            .keys()
            .then((keys) =>
                Promise.all(
                    keys.filter((key) => key !== CACHE).map((key) => self.caches.delete(key)),
                ),
            )
            .then(() => self.clients.claim()),
    );
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);

    if (request.method !== 'GET' || url.origin !== self.location.origin) return;

    if (request.mode === 'navigate') {
        event.respondWith(networkFirst(request));
    } else if (url.pathname.startsWith('/assets/')) {
        event.respondWith(cacheFirst(request));
    }
});

async function precache() {
    try {
        const response = await self.fetch(SHELL, { cache: 'reload' });
        if (!response.ok) return;

        const html = await response.clone().text();
        const cache = await self.caches.open(CACHE);
        await cache.put(SHELL, response);
        await cache.addAll(assetsIn(html));
    } catch {
        // Installed on a dead network. Nothing to cache, nothing to report.
    }
}

function assetsIn(html) {
    return [...html.matchAll(/["'](\/assets\/[^"']+)["']/g)].map((match) => match[1]);
}

async function cacheFirst(request) {
    const hit = await self.caches.match(request, MATCH);
    if (hit) return hit;

    const response = await self.fetch(request);
    await store(request, response);
    return response;
}

async function networkFirst(request) {
    const cached = await self.caches.match(SHELL, MATCH);

    if (cached && self.navigator.onLine === false) return cached;

    const pending = self.fetch(request).then(async (response) => {
        await store(SHELL, response);
        return response;
    });

    if (!cached) return pending;

    return Promise.race([pending, rejectAfter(NETWORK_TIMEOUT_MS)]).catch(() => cached);
}

function rejectAfter(ms) {
    return new Promise((_, reject) => setTimeout(() => reject(new Error('slow network')), ms));
}

async function store(key, response) {
    if (!response.ok) return;
    const cache = await self.caches.open(CACHE);
    await cache.put(key, response.clone());
}

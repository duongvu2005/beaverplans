import { describe, it, expect, vi } from 'vitest';
// ?raw rather than node:fs: @types/node is deliberately out of tsconfig.app's
// "types", and this keeps the worker's real source under test either way.
import SOURCE from '../../public/sw.js?raw';

/*
 * public/sw.js, run against a fake worker scope.
 *
 * The source is evaluated with a hand-built `self` in place of the real
 * ServiceWorkerGlobalScope, so sw.js must reach every global through `self` and
 * import nothing, or none of this runs.
 *
 * Testing strategy
 *     partition on install: shell reachable | shell unreachable
 *     partition on request: navigation | /assets/ | other same-origin |
 *         cross-origin | non-GET
 *     partition on cache: shell present | absent | left by an earlier version
 *     partition on network: responds | fails | never settles
 *     partition on navigator.onLine: true | false
 */

const ORIGIN = 'https://beaverplans.test';

const INDEX_HTML = `<!doctype html>
<html><head>
<link rel="stylesheet" href="/assets/index-AbC123.css">
<link rel="manifest" href="/site.webmanifest">
</head><body>
<script type="module" src="/assets/index-XyZ789.js"></script>
</body></html>`;

/** The files the fake network serves, by pathname. */
const ORIGIN_FILES: Record<string, string> = {
    '/': INDEX_HTML,
    '/assets/index-AbC123.css': 'body{}',
    '/assets/index-XyZ789.js': 'console.log(1)',
    '/assets/font-Q4.woff2': 'woff2 bytes',
};

type Handler = (event: unknown) => void;

/**
 * Cache and CacheStorage, keyed by URL — enough of the shape sw.js uses.
 *
 * Vary is modelled, because it is what broke this in the real browser: a match
 * only counts when the stored response carries no Vary, or the request that
 * stored it sent the same Origin as the one asking, or the caller opts out with
 * ignoreVary. Vite marks the bundle `crossorigin`, so the page sends an Origin
 * header for it and the worker's own fetch does not.
 */
function fakeCaches() {
    const stores = new Map<string, Map<string, Entry>>();

    const open = async (name: string) => {
        const entries = stores.get(name) ?? new Map<string, Entry>();
        stores.set(name, entries);
        return {
            put: async (key: Keyed | string, response: Response) => {
                entries.set(urlOf(key), { response, origin: originOf(key) });
            },
            addAll: async (keys: readonly string[]) => {
                const fetched = await Promise.all(keys.map((key) => scopeFetch(key)));
                keys.forEach((key, index) =>
                    entries.set(urlOf(key), { response: fetched[index]!, origin: undefined }),
                );
            },
        };
    };

    return {
        stores,
        open,
        keys: async () => [...stores.keys()],
        delete: async (name: string) => stores.delete(name),
        match: async (key: Keyed | string, options?: { ignoreVary?: boolean }) => {
            for (const entries of stores.values()) {
                const hit = entries.get(urlOf(key));
                if (!hit) continue;
                const varies = hit.response.headers.get('vary') === 'Origin';
                if (varies && !options?.ignoreVary && hit.origin !== originOf(key)) continue;
                return hit.response;
            }
            return undefined;
        },
    };
}

interface Entry {
    readonly response: Response;
    /** The Origin header the request that stored this one sent, if any. */
    readonly origin: string | undefined;
}

function urlOf(key: Keyed | string) {
    return new URL(typeof key === 'string' ? key : key.url, ORIGIN).href;
}

function originOf(key: Keyed | string) {
    return typeof key === 'string' ? undefined : key.origin;
}

interface Keyed {
    readonly url: string;
    /** Set when the request carries an Origin header, as a crossorigin one does. */
    readonly origin?: string | undefined;
}

// Assigned per scope so the fake Cache.addAll goes through the same network.
let scopeFetch: (input: Keyed | string) => Promise<Response>;

interface ScopeOptions {
    readonly online?: boolean;
    /** 'ok' serves ORIGIN_FILES, 'offline' rejects, 'hang' never settles. */
    readonly network?: 'ok' | 'offline' | 'hang';
    /** The open windows activate will find. */
    readonly windows?: readonly FakeClient[];
}

/** A window client. `navigate` is optional: some browsers, Safari above all,
 *  do not have it. */
interface FakeClient {
    readonly url: string;
    readonly navigate?: (url: string) => Promise<unknown>;
}

function windowClient(url = `${ORIGIN}/`): FakeClient & { navigate: Handler } {
    return { url, navigate: vi.fn(async () => {}) };
}

function createScope({ online = true, network = 'ok', windows = [] }: ScopeOptions = {}) {
    const handlers = new Map<string, Handler>();
    const caches = fakeCaches();
    // Every step activate takes, so a test can assert claim happens before
    // navigate: navigate rejects on a client this worker does not yet control.
    const order: string[] = [];

    const fetch = vi.fn(async (input: Keyed | string) => {
        if (network === 'hang') return new Promise<Response>(() => {});
        // What Safari throws with the radio off, and the message the user saw.
        if (network === 'offline') throw new TypeError('Load failed');

        const pathname = new URL(urlOf(input)).pathname;
        const body = ORIGIN_FILES[pathname];
        if (body === undefined) return new Response('missing', { status: 404 });
        // What a CDN sends for an asset it may serve cross-origin.
        const headers: Record<string, string> = pathname.startsWith('/assets/')
            ? { Vary: 'Origin' }
            : {};
        return new Response(body, { status: 200, headers });
    });
    scopeFetch = fetch;

    // Wrapped rather than recorded in windowClient so the order is per scope.
    const observed = windows.map((client) => {
        const navigate = client.navigate;
        if (navigate === undefined) return client;
        return {
            ...client,
            navigate: async (url: string) => {
                order.push('navigate');
                return navigate(url);
            },
        };
    });

    const self = {
        addEventListener: (type: string, handler: Handler) => handlers.set(type, handler),
        skipWaiting: vi.fn(),
        clients: {
            claim: vi.fn(async () => {
                order.push('claim');
            }),
            matchAll: vi.fn(async () => observed),
        },
        location: { origin: ORIGIN },
        navigator: { onLine: online },
        caches,
        fetch,
    };

    new Function('self', SOURCE)(self);

    return { self, handlers, caches, fetch, order };
}

/** Runs the install handler and settles whatever it passed to waitUntil. */
async function install(scope: ReturnType<typeof createScope>) {
    let pending: Promise<unknown> = Promise.resolve();
    scope.handlers.get('install')!({ waitUntil: (p: Promise<unknown>) => (pending = p) });
    await pending;
}

/** Runs the activate handler and settles whatever it passed to waitUntil. */
async function activate(scope: ReturnType<typeof createScope>) {
    let pending: Promise<unknown> = Promise.resolve();
    scope.handlers.get('activate')!({ waitUntil: (p: Promise<unknown>) => (pending = p) });
    await pending;
}

/** Dispatches a fetch event and returns what respondWith was given, if anything. */
function request(
    scope: ReturnType<typeof createScope>,
    url: string,
    init: { method?: string; mode?: string; origin?: string } = {},
) {
    let responded: Promise<Response> | undefined;
    // A real Request has read-only url/mode and jsdom will not construct a
    // navigation at all, so the handler is handed a stand-in carrying the
    // fields it reads.
    const event = {
        request: {
            url: new URL(url, ORIGIN).href,
            method: init.method ?? 'GET',
            mode: init.mode ?? 'cors',
            origin: init.origin,
        },
        respondWith: (p: Promise<Response>) => (responded = p),
    };
    scope.handlers.get('fetch')!(event);
    return responded;
}

function cachedPaths(scope: ReturnType<typeof createScope>) {
    const paths: string[] = [];
    for (const entries of scope.caches.stores.values()) {
        for (const url of entries.keys()) paths.push(new URL(url).pathname);
    }
    return paths.sort();
}

describe('the service worker', () => {
    describe('install', () => {
        it('precaches the shell and the assets the document names', async () => {
            const scope = createScope();

            await install(scope);

            // The page that registers the worker was fetched before the worker
            // existed, so nothing caches itself: install has to go and get it.
            expect(cachedPaths(scope)).toEqual([
                '/',
                '/assets/index-AbC123.css',
                '/assets/index-XyZ789.js',
            ]);
        });

        it('activates even when the shell cannot be fetched', async () => {
            const scope = createScope({ network: 'offline' });

            await expect(install(scope)).resolves.not.toThrow();

            // A worker with an empty cache still beats no worker at all: the
            // next load fills it.
            expect(scope.self.skipWaiting).toHaveBeenCalled();
        });
    });

    describe('activate', () => {
        it('drops caches left by an earlier version', async () => {
            const scope = createScope();
            await scope.caches.open('shell-v0');

            await install(scope);
            await activate(scope);

            expect(await scope.caches.keys()).toEqual(['shell-v1']);
        });

        it('claims the open windows, which is what reloads them', async () => {
            // The reload itself is the page's: claim fires controllerchange, and
            // registerServiceWorker.ts acts on it. Nothing navigates from here —
            // two navigations of one document abort each other.
            const scope = createScope();

            await install(scope);
            await activate(scope);

            expect(scope.self.clients.claim).toHaveBeenCalled();
        });

        it('does not navigate clients itself', async () => {
            const board = windowClient(`${ORIGIN}/`);
            const scope = createScope({ windows: [board] });
            await scope.caches.open('shell-v0');

            await install(scope);
            await activate(scope);

            expect(board.navigate).not.toHaveBeenCalled();
        });
    });

    describe('navigations', () => {
        it('serves the precached shell when the network is down', async () => {
            const scope = createScope();
            await install(scope);

            const offline = createScope({ network: 'offline', online: false });
            offline.caches.stores.set('shell-v1', scope.caches.stores.get('shell-v1')!);

            const response = await request(offline, '/', { mode: 'navigate' });

            expect(await response!.text()).toBe(INDEX_HTML);
        });

        it('does not wait on the network when the browser knows it is offline', async () => {
            // The ten-second cold start: with the radio off a fetch does not
            // fail, it hangs, and the fallback cannot run until it gives up.
            const scope = createScope({ network: 'hang', online: false });
            const cache = await scope.caches.open('shell-v1');
            await cache.put('/', new Response(INDEX_HTML));

            const response = await request(scope, '/', { mode: 'navigate' });

            expect(await response!.text()).toBe(INDEX_HTML);
            expect(scope.fetch).not.toHaveBeenCalled();
        });

        it('falls back to the shell for a URL that was never cached', async () => {
            const scope = createScope({ network: 'offline', online: false });
            const cache = await scope.caches.open('shell-v1');
            await cache.put('/', new Response(INDEX_HTML));

            const response = await request(scope, '/?from=homescreen', { mode: 'navigate' });

            expect(await response!.text()).toBe(INDEX_HTML);
        });

        it('prefers the network when there is one', async () => {
            const scope = createScope();
            const cache = await scope.caches.open('shell-v1');
            await cache.put('/', new Response('stale'));

            const response = await request(scope, '/', { mode: 'navigate' });

            expect(await response!.text()).toBe(INDEX_HTML);
        });
    });

    describe('assets', () => {
        it('serves a hashed asset from the cache without asking the network', async () => {
            const scope = createScope();
            await install(scope);
            scope.fetch.mockClear();

            const response = await request(scope, '/assets/index-XyZ789.js');

            expect(await response!.text()).toBe('console.log(1)');
            expect(scope.fetch).not.toHaveBeenCalled();
        });

        it('serves a precached asset to the crossorigin request the page makes', async () => {
            // Vite marks the bundle crossorigin, so the page sends an Origin
            // header that the worker's own precache fetch never sent. Against a
            // response that carries Vary: Origin those two do not match, and the
            // whole precache is invisible to the page that needs it.
            const scope = createScope();
            await install(scope);
            scope.fetch.mockClear();

            const response = await request(scope, '/assets/index-XyZ789.js', { origin: ORIGIN });

            expect(await response!.text()).toBe('console.log(1)');
            expect(scope.fetch).not.toHaveBeenCalled();
        });

        it('fetches and stores one it has not seen', async () => {
            const scope = createScope();

            const response = await request(scope, '/assets/font-Q4.woff2');

            expect(await response!.text()).toBe('woff2 bytes');
            expect(cachedPaths(scope)).toContain('/assets/font-Q4.woff2');
        });
    });

    describe('what it leaves alone', () => {
        it('ignores other same-origin paths', () => {
            const scope = createScope();

            expect(request(scope, '/_vercel/insights/script.js')).toBeUndefined();
        });

        it('ignores cross-origin requests', () => {
            const scope = createScope();

            expect(request(scope, 'https://supabase.test/rest/v1/weeks')).toBeUndefined();
        });

        it('ignores anything that is not a GET', () => {
            const scope = createScope();

            expect(request(scope, '/', { method: 'POST', mode: 'navigate' })).toBeUndefined();
        });
    });
});

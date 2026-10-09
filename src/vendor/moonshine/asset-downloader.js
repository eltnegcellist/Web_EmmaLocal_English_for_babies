/**
 * Fetches model assets from the Moonshine CDN and caches them in the browser,
 * driven by the JSON manifest helpers in the C ABI (so we never re-implement
 * the file/URL layout in JS). Mirrors the download flow of the Python/Swift/
 * Android bindings, adapted to `fetch` + the Cache API.
 */
import { MoonshineDownloadError } from './errors.js';
import { clearResumableDownload, downloadResumable } from '../../resumable-download.js';
export const MOONSHINE_MODEL_CACHE = 'moonshine-models-v1';
const DEFAULT_CACHE = MOONSHINE_MODEL_CACHE;
const diagnosticNow = () => typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

export function canonicalMoonshineModelAssetKey(value) {
    try {
        const parsed = new URL(String(value));
        const marker = '/model/';
        const index = parsed.pathname.indexOf(marker);
        return index >= 0 ? parsed.pathname.slice(index) : parsed.pathname;
    }
    catch {
        const clean = String(value || '').split(/[?#]/)[0];
        const marker = '/model/';
        const index = clean.indexOf(marker);
        return index >= 0 ? clean.slice(index) : clean;
    }
}

async function findCompatibleCacheHit(cache, url, { repairAlias = true } = {}) {
    const exact = await cache.match(url);
    if (exact)
        return { response: exact, matchType: 'exact', cachedUrl: url };
    const targetKey = canonicalMoonshineModelAssetKey(url);
    const requests = await cache.keys();
    const compatible = requests.find(request =>
        canonicalMoonshineModelAssetKey(request.url) === targetKey
    );
    if (!compatible)
        return null;
    const response = await cache.match(compatible);
    if (!response)
        return null;
    if (repairAlias) {
        await cache.put(url, response.clone()).catch(() => {});
    }
    return { response, matchType: 'canonical-path', cachedUrl: compatible.url };
}

function parseManifest(manifestJson) {
    const manifest = typeof manifestJson === 'string' ? JSON.parse(manifestJson) : manifestJson;
    const groups = manifest?.groups ?? [];
    const files = [];
    for (const group of groups) {
        for (const file of group.files ?? []) {
            const url = file.url ?? joinUrl(group.base_url, file.name);
            files.push({
                name: file.name,
                url,
                size: typeof file.size === 'number' && file.size >= 0 ? file.size : null,
            });
        }
    }
    return files;
}

export async function inspectMoonshineCacheInventory(cacheName = DEFAULT_CACHE) {
    if (typeof caches === 'undefined')
        return { supported: false, entryCount: 0 };
    const cache = await caches.open(cacheName);
    const requests = await cache.keys();
    return {
        supported: true,
        entryCount: requests.length,
        canonicalKeys: requests.map(request => canonicalMoonshineModelAssetKey(request.url)),
    };
}

export async function inspectMoonshineManifestCache(manifestJson, options = {}) {
    const cacheName = options.cacheName ?? DEFAULT_CACHE;
    const repairAliases = options.repairAliases !== false;
    const files = parseManifest(manifestJson);
    if (typeof caches === 'undefined') {
        return {
            supported: false,
            status: 'unsupported',
            expectedFiles: files.length,
            presentFiles: 0,
            expectedBytes: files.reduce((sum, file) => sum + (file.size ?? 0), 0),
            presentBytes: 0,
            aliasHits: 0,
            missingFiles: files.map(file => file.name),
        };
    }
    const cache = await caches.open(cacheName);
    const requests = await cache.keys();
    const exactUrls = new Map(requests.map(request => [request.url, request]));
    const byCanonicalKey = new Map();
    for (const request of requests) {
        const key = canonicalMoonshineModelAssetKey(request.url);
        if (!byCanonicalKey.has(key))
            byCanonicalKey.set(key, request);
    }

    let presentFiles = 0;
    let presentBytes = 0;
    let aliasHits = 0;
    const missingFiles = [];
    for (const file of files) {
        let request = exactUrls.get(file.url);
        let alias = false;
        if (!request) {
            request = byCanonicalKey.get(canonicalMoonshineModelAssetKey(file.url));
            alias = Boolean(request);
        }
        if (!request) {
            missingFiles.push(file.name);
            continue;
        }
        const response = await cache.match(request);
        if (!response) {
            missingFiles.push(file.name);
            continue;
        }
        presentFiles += 1;
        presentBytes += file.size ?? 0;
        if (alias) {
            aliasHits += 1;
            if (repairAliases) {
                await cache.put(file.url, response.clone()).catch(() => {});
            }
        }
    }
    const expectedBytes = files.reduce((sum, file) => sum + (file.size ?? 0), 0);
    return {
        supported: true,
        status: missingFiles.length === 0 ? 'complete' : presentFiles === 0 ? 'missing' : 'partial',
        expectedFiles: files.length,
        presentFiles,
        expectedBytes,
        presentBytes,
        aliasHits,
        missingFiles,
        entryCount: requests.length,
    };
}
/**
 * Downloads model files with transparent caching. A single instance can be
 * reused across models; entries are keyed by absolute URL.
 */
export class AssetDownloader {
    cacheName;
    onProgress;
    baseUrl;
    session;
    onAssetEvent;
    constructor(options = {}) {
        this.cacheName = options.cacheName ?? DEFAULT_CACHE;
        this.onProgress = options.onProgress;
        this.baseUrl = options.baseUrl;
        this.onAssetEvent = options.onAssetEvent;
    }
    /**
     * Downloads every file listed in a `{groups:[...]}` manifest (STT / embedding),
     * returning them keyed by canonical filename.
     */
    async downloadManifest(manifestJson) {
        let manifest;
        try {
            manifest = JSON.parse(manifestJson);
        }
        catch (err) {
            throw new MoonshineDownloadError(`Failed to parse model manifest: ${err.message}`);
        }
        const groups = manifest.groups ?? [];
        return this.inSession(declaredTotalBytes(groups), async () => {
            const out = new Map();
            for (const group of groups) {
                for (const file of group.files) {
                    const url = this.baseUrl
                        ? joinUrl(this.baseUrl, file.name)
                        : (file.url ?? joinUrl(group.base_url, file.name));
                    const bytes = await this.fetchFile(url, file.size);
                    if (typeof file.size === 'number' &&
                        file.size >= 0 &&
                        bytes.byteLength !== file.size) {
                        throw new MoonshineDownloadError(`Size mismatch for ${file.name}: expected ${file.size} bytes, ` +
                            `got ${bytes.byteLength} (from ${url})`);
                    }
                    out.set(file.name, bytes);
                }
            }
            return out;
        });
    }
    /** Downloads a flat list of URLs, returning bytes keyed by basename. */
    async downloadFiles(urls) {
        return this.inSession(undefined, async () => {
            const out = new Map();
            for (const url of urls) {
                out.set(basename(url), await this.fetchFile(url));
            }
            return out;
        });
    }
    /**
     * Downloads a map of canonical filename -> URL, returning bytes keyed by the
     * supplied filename (not the URL basename). Use this when the caller controls
     * the canonical keys, e.g. feeding a transcriber's in-memory loader.
     */
    async downloadNamedFiles(files) {
        const entries = files instanceof Map ? [...files.entries()] : Object.entries(files);
        return this.inSession(undefined, async () => {
            const out = new Map();
            for (const [name, url] of entries) {
                out.set(name, await this.fetchFile(url));
            }
            return out;
        });
    }
    /** Fetches a single URL, using the Cache API when available. */
    async fetchFile(url, expectedSize) {
        const file = basename(url);
        const cache = await this.openCache();
        if (cache) {
            const lookupStarted = diagnosticNow();
            const hit = await findCompatibleCacheHit(cache, url, { repairAlias: true });
            const lookupMs = diagnosticNow() - lookupStarted;
            if (hit) {
                this.reportProgress(0, undefined, file, { source: 'cache' });
                const readStarted = diagnosticNow();
                const buf = await hit.response.arrayBuffer();
                const readMs = diagnosticNow() - readStarted;
                const sizeValid = typeof expectedSize !== 'number' || expectedSize < 0 || buf.byteLength === expectedSize;
                if (sizeValid) {
                    await clearResumableDownload(url).catch(() => {});
                    this.reportProgress(buf.byteLength, buf.byteLength, file, { source: 'cache' });
                    this.onAssetEvent?.({
                        kind: 'cache-read',
                        file,
                        url,
                        matchType: hit.matchType,
                        cachedUrl: hit.cachedUrl,
                        bytes: buf.byteLength,
                        lookupMs,
                        readMs,
                        durationMs: lookupMs + readMs,
                    });
                    this.finishFile(buf.byteLength);
                    return new Uint8Array(buf);
                }
                await cache.delete(url).catch(() => {});
                this.onAssetEvent?.({
                    kind: 'cache-invalid',
                    file,
                    url,
                    matchType: hit.matchType,
                    cachedUrl: hit.cachedUrl,
                    expectedBytes: expectedSize,
                    actualBytes: buf.byteLength,
                    lookupMs,
                    readMs,
                });
            }
            else {
                this.onAssetEvent?.({
                    kind: 'cache-miss',
                    file,
                    url,
                    canonicalKey: canonicalMoonshineModelAssetKey(url),
                    lookupMs,
                });
            }
        }
        let result;
        const downloadStarted = diagnosticNow();
        try {
            result = await downloadResumable(url, {
                background: {
                    cacheName: this.cacheName,
                    cacheKey: url,
                },
                onProgress: (loaded, total, detail) => this.reportProgress(
                    loaded,
                    total,
                    file,
                    { source: 'network', resumed: Boolean(detail?.resumed) }
                ),
            });
        }
        catch (error) {
            throw new MoonshineDownloadError(
                `Failed to download ${url}: ${error?.message || error}`
            );
        }
        const downloadMs = diagnosticNow() - downloadStarted;
        const buf = result.buffer;
        let cacheWriteMs = 0;
        if (cache) {
            const writeStarted = diagnosticNow();
            await cache.put(url, new Response(buf));
            cacheWriteMs = diagnosticNow() - writeStarted;
        }
        await clearResumableDownload(url).catch(() => {});
        this.onAssetEvent?.({
            kind: 'network-download',
            file,
            url,
            canonicalKey: canonicalMoonshineModelAssetKey(url),
            bytes: Number(result.networkLoaded) || buf.byteLength,
            assetBytes: buf.byteLength,
            resumed: Boolean(result.resumed),
            durationMs: downloadMs,
            cacheWriteMs,
        });
        this.finishFile(buf.byteLength);
        return new Uint8Array(buf);
    }
    /**
     * Runs `body` as a single accounted download, so progress is reported
     * against the whole set of files rather than restarting at zero for each.
     * Nested calls (a shared downloader fetching several models) each get their
     * own accounting and restore the outer one when they finish.
     */
    async inSession(totalBytes, body) {
        const outer = this.session;
        this.session = { totalBytes, completedBytes: 0 };
        try {
            return await body();
        }
        finally {
            this.session = outer;
        }
    }
    /** Rolls a finished file's bytes into the running total. */
    finishFile(bytes) {
        if (this.session)
            this.session.completedBytes += bytes;
    }
    reportProgress(loadedInFile, fileTotal, file, detail = {}) {
        if (!this.onProgress)
            return;
        if (!this.session) {
            this.onProgress(loadedInFile, fileTotal, file, detail);
            return;
        }
        this.onProgress(this.session.completedBytes + loadedInFile, this.session.totalBytes, file, detail);
    }
    async readWithProgress(response, file) {
        const total = Number(response.headers.get('content-length')) || undefined;
        if (!response.body || !this.onProgress) {
            const buf = await response.arrayBuffer();
            this.reportProgress(buf.byteLength, total, file);
            return buf;
        }
        const reader = response.body.getReader();
        const chunks = [];
        let loaded = 0;
        for (;;) {
            const { done, value } = await reader.read();
            if (done)
                break;
            if (value) {
                chunks.push(value);
                loaded += value.byteLength;
                this.reportProgress(loaded, total, file);
            }
        }
        const merged = new Uint8Array(loaded);
        let offset = 0;
        for (const chunk of chunks) {
            merged.set(chunk, offset);
            offset += chunk.byteLength;
        }
        return merged.buffer;
    }
    async openCache() {
        try {
            if (typeof caches !== 'undefined') {
                return await caches.open(this.cacheName);
            }
        }
        catch {
            // Cache API not available (e.g. non-secure context / Node) — skip.
        }
        return undefined;
    }
}
/**
 * Total size of a manifest, or undefined if any file leaves its size out.
 * Partial sums would understate the download and make the bar run backwards,
 * so an incomplete manifest is treated as no answer at all.
 */
function declaredTotalBytes(groups) {
    let total = 0;
    for (const group of groups) {
        for (const file of group.files ?? []) {
            if (typeof file.size !== 'number' || !(file.size >= 0))
                return undefined;
            total += file.size;
        }
    }
    return total;
}
function joinUrl(base, file) {
    return `${base.replace(/\/+$/, '')}/${file.replace(/^\/+/, '')}`;
}
function basename(url) {
    const clean = url.split(/[?#]/)[0];
    const idx = clean.lastIndexOf('/');
    return idx >= 0 ? clean.slice(idx + 1) : clean;
}
//# sourceMappingURL=asset-downloader.js.map
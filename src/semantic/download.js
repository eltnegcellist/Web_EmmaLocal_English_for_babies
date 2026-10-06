// Fetch streams contain decoded bytes. Content-Length can describe compressed
// HTTP bytes on Pages, so use the pinned asset size rather than that header.
export async function downloadSemanticAsset(url, expectedBytes, onProgress, fetcher = fetch) {
  if (!Number.isSafeInteger(expectedBytes) || expectedBytes <= 0) throw Error('意味判定データのサイズが不正です。');
  const response = await fetcher(url, { cache: 'no-store' });
  if (!response.ok) throw Error(`HTTP ${response.status} fetching ${url}`);
  const bytes = new Uint8Array(expectedBytes);
  let loaded = 0;
  function append(chunk) {
    if (loaded + chunk.byteLength > expectedBytes) throw Error('意味判定データのサイズが一致しません。');
    bytes.set(chunk, loaded); loaded += chunk.byteLength; onProgress?.(loaded);
  }
  const reader = response.body?.getReader();
  if (reader) {
    try {
      for (;;) { const { done, value } = await reader.read(); if (done) break; if (value?.byteLength) append(value); }
    } finally { reader.releaseLock(); }
  } else append(new Uint8Array(await response.arrayBuffer()));
  if (loaded !== expectedBytes) throw Error('意味判定データの取得が途中で終了しました。もう一度準備してください。');
  return bytes.buffer;
}

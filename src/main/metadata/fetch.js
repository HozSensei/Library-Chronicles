/**
 * fetch avec timeout — erreurs réseau / timeout gracieuses.
 */

const DEFAULT_TIMEOUT_MS = 8000;

/**
 * @param {string|URL} url
 * @param {{ timeoutMs?: number, headers?: Record<string,string>, method?: string, body?: string, signal?: AbortSignal }} [opts]
 */
export async function fetchJson(url, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  if (opts.signal) {
    if (opts.signal.aborted) {
      clearTimeout(timer);
      throw new Error('Abandonné');
    }
    opts.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    const res = await fetch(String(url), {
      method: opts.method || 'GET',
      headers: opts.headers,
      body: opts.body,
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error(`Timeout réseau (${timeoutMs} ms)`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

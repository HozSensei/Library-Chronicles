/**
 * Helpers cache / dedupe in-flight (main + renderer).
 * Pur — pas d’Electron.
 */

/**
 * Cache TTL + déduplication des promesses en vol.
 * @template T
 */
export function createTtlCache({ maxEntries = 64, ttlMs = 60_000 } = {}) {
  /** @type {Map<string, { value: T, at: number }>} */
  const map = new Map();
  /** @type {Map<string, Promise<T>>} */
  const inflight = new Map();

  function prune(now = Date.now()) {
    for (const [k, entry] of map) {
      if (now - entry.at > ttlMs) map.delete(k);
    }
    while (map.size > maxEntries) {
      const oldest = map.keys().next().value;
      map.delete(oldest);
    }
  }

  /**
   * @param {string} key
   * @param {() => Promise<T>} factory
   * @param {{ force?: boolean }} [opts]
   * @returns {Promise<T>}
   */
  async function getOrLoad(key, factory, { force = false } = {}) {
    const now = Date.now();
    if (!force) {
      const hit = map.get(key);
      if (hit && now - hit.at <= ttlMs) return hit.value;
      const pending = inflight.get(key);
      if (pending) return pending;
    }
    const promise = (async () => {
      try {
        const value = await factory();
        map.set(key, { value, at: Date.now() });
        prune();
        return value;
      } finally {
        inflight.delete(key);
      }
    })();
    inflight.set(key, promise);
    return promise;
  }

  function peek(key) {
    const hit = map.get(key);
    if (!hit) return undefined;
    if (Date.now() - hit.at > ttlMs) {
      map.delete(key);
      return undefined;
    }
    return hit.value;
  }

  function set(key, value) {
    map.set(key, { value, at: Date.now() });
    prune();
  }

  function invalidate(key) {
    if (key == null) {
      map.clear();
      return;
    }
    map.delete(key);
  }

  function clear() {
    map.clear();
    inflight.clear();
  }

  return {
    getOrLoad,
    peek,
    set,
    invalidate,
    clear,
    get size() {
      return map.size;
    },
  };
}

/**
 * LRU simple pour buffers / pages.
 * @template V
 */
export function createLruMap(maxSize = 12) {
  /** @type {Map<any, V>} */
  const map = new Map();

  function get(key) {
    if (!map.has(key)) return undefined;
    const value = map.get(key);
    map.delete(key);
    map.set(key, value);
    return value;
  }

  function set(key, value) {
    if (map.has(key)) map.delete(key);
    map.set(key, value);
    while (map.size > maxSize) {
      const oldest = map.keys().next().value;
      map.delete(oldest);
    }
  }

  function has(key) {
    return map.has(key);
  }

  function del(key) {
    return map.delete(key);
  }

  function clear() {
    map.clear();
  }

  return {
    get,
    set,
    has,
    delete: del,
    clear,
    get size() {
      return map.size;
    },
    keys() {
      return map.keys();
    },
    values() {
      return map.values();
    },
    entries() {
      return map.entries();
    },
    [Symbol.iterator]() {
      return map[Symbol.iterator]();
    },
  };
}

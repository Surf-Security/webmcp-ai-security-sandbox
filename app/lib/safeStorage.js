/**
 * localStorage wrapped in try/catch — private browsing, a full quota, or storage disabled
 * entirely should degrade to "nothing persists this session" rather than throwing and breaking
 * the feature using it. One shared implementation instead of each caller reinventing this.
 */
export function safeGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function safeGetJSON(key, fallback) {
  const raw = safeGet(key);
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export function safeSetJSON(key, value) {
  return safeSet(key, JSON.stringify(value));
}

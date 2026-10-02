// Decides whether an actual smoke-step response matches its expectation.
// Exact on purpose: a redirect must land on the expected path, not merely start with it.

/**
 * @param {{ status: number, location: string }} actual
 * @param {{ status: number, path?: string, error?: boolean }} expected
 * @param {string} baseUrl
 * @returns {boolean}
 */
export function matches(actual, expected, baseUrl) {
  if (actual.status !== expected.status) return false;
  if (expected.path === undefined) return true;
  if (!actual.location) return false;

  let url;
  try {
    url = new URL(actual.location, baseUrl);
  } catch {
    return false;
  }
  if (url.origin !== new URL(baseUrl).origin) return false;
  if (url.pathname !== expected.path) return false;

  const error = url.searchParams.get("error");
  return expected.error === true ? Boolean(error) : error === null;
}

/**
 * True when an anonymous request was stopped before reaching the app:
 * 401/403, or a 302 to a Cloudflare Access login host.
 * @param {{ status: number, location: string }} actual
 * @param {string} baseUrl
 * @returns {boolean}
 */
export function blocksAnonymous(actual, baseUrl) {
  if (actual.status === 401 || actual.status === 403) return true;
  if (actual.status !== 302 || !actual.location) return false;
  try {
    return new URL(actual.location, baseUrl).hostname.endsWith(".cloudflareaccess.com");
  } catch {
    return false;
  }
}

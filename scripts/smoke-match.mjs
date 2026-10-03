// Decides whether an actual smoke-step response matches its expectation.
// Exact on purpose: a redirect must land on the expected path, not merely start with it.

/**
 * @param {{ status: number, location: string, body?: string }} actual
 * @param {{ status: number, path?: string, error?: boolean, bodyIncludes?: string, bodyExcludes?: string }} expected
 * @param {string} baseUrl
 * @returns {boolean}
 */
export function matches(actual, expected, baseUrl) {
  if (actual.status !== expected.status) return false;
  if (expected.path !== undefined && !matchesRedirect(actual.location, expected, baseUrl)) return false;
  return matchesBody(actual.body, expected);
}

/**
 * @param {string} location
 * @param {{ path?: string, error?: boolean }} expected
 * @param {string} baseUrl
 * @returns {boolean}
 */
function matchesRedirect(location, expected, baseUrl) {
  if (!location) return false;

  let url;
  try {
    url = new URL(location, baseUrl);
  } catch {
    return false;
  }
  if (url.origin !== new URL(baseUrl).origin) return false;
  if (url.pathname !== expected.path) return false;

  const error = url.searchParams.get("error");
  return expected.error === true ? Boolean(error) : error === null;
}

/**
 * A body expectation with no body to check fails rather than passing vacuously.
 * @param {string | undefined} body
 * @param {{ bodyIncludes?: string, bodyExcludes?: string }} expected
 * @returns {boolean}
 */
function matchesBody(body, expected) {
  if (expected.bodyIncludes === undefined && expected.bodyExcludes === undefined) return true;
  if (typeof body !== "string") return false;
  if (expected.bodyIncludes !== undefined && !body.includes(expected.bodyIncludes)) return false;
  if (expected.bodyExcludes !== undefined && body.includes(expected.bodyExcludes)) return false;
  return true;
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

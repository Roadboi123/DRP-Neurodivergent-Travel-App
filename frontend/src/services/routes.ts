import { apiUrl, localApiUrl } from '@/services/api-client';
import type { RouteOption } from '@/types/route';

/** Build the `/routes/` query string, applying a username only when provided. */
function buildRoutesQuery(start: string, end: string, username: string): string {
  const startParam = encodeURIComponent(start.trim());
  const endParam = encodeURIComponent(end.trim());
  const userParam = username.trim()
    ? `&username=${encodeURIComponent(username.trim())}`
    : '';
  return `routes/?start=${startParam}&end=${endParam}${userParam}`;
}

/**
 * Fetch route suggestions from the deployed backend, transparently falling back
 * to a local FastAPI instance if the production backend is unreachable.
 *
 * Throws if neither backend can be reached; callers decide how to surface that.
 */
export async function getRoutes(
  start: string,
  end: string,
  username: string
): Promise<RouteOption[]> {
  const query = buildRoutesQuery(start, end, username);

  try {
    // Trailing slash is already part of the query to avoid an HTTP redirect.
    const res = await fetch(apiUrl(`/${query}`));
    if (!res.ok) {
      throw new Error('Railway backend response error');
    }
    return (await res.json()) as RouteOption[];
  } catch (error) {
    console.warn('Production backend unavailable, trying local backend...', error);

    const localRes = await fetch(localApiUrl(`/${query}`));
    if (!localRes.ok) {
      throw new Error('Local backend response error');
    }
    return (await localRes.json()) as RouteOption[];
  }
}

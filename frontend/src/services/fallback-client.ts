import type { HttpClient } from '@/services/http-client';

/**
 * Wrap two clients so calls hit `primary` first and, if it *throws* (e.g. the
 * backend is unreachable or returns a non-ok status via `get`/`post`), transparently
 * retry against `fallback`. The result satisfies {@link HttpClient}, so a service
 * receiving it cannot tell failover is happening — composition, not inheritance.
 *
 * Any service can opt into failover simply by being handed this wrapped client
 * in the composition root; the service code stays fallback-agnostic.
 *
 * Note: `getResponse`/`postResponse` do not throw on a non-ok status, so a clean
 * 404/409 from the primary is returned as-is and does NOT trigger the fallback.
 */
export function createFallbackClient(
  primary: HttpClient,
  fallback: HttpClient
): HttpClient {
  async function withFallback<T>(
    attempt: (client: HttpClient) => Promise<T>
  ): Promise<T> {
    try {
      return await attempt(primary);
    } catch (error) {
      console.warn('Primary backend unavailable, trying fallback backend...', error);
      return attempt(fallback);
    }
  }

  return {
    get: <T>(path: string) => withFallback((client) => client.get<T>(path)),
    post: <T>(path: string, body: unknown) => withFallback((client) => client.post<T>(path, body)),
    delete: <T>(path: string) => withFallback((client) => client.delete<T>(path)),
    getResponse: (path: string) => withFallback((client) => client.getResponse(path)),
    postResponse: (path: string, body: unknown) =>
      withFallback((client) => client.postResponse(path, body)),
  };
}

import type { HttpClient } from '@/services/http-client';

export interface HealthService {
  /** Returns true when the backend `/health` endpoint reports `status: "ok"`. */
  checkBackendHealth(): Promise<boolean>;
}

/** Build a {@link HealthService} over an injected client. */
export function createHealthService(client: HttpClient): HealthService {
  return {
    async checkBackendHealth() {
      const data = await client.get<{ status: string }>('/health');
      return data.status === 'ok';
    },
  };
}

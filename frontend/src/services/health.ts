import { apiUrl } from '@/services/api-client';

/** Returns true when the backend `/health` endpoint reports `status: "ok"`. */
export async function checkBackendHealth(): Promise<boolean> {
  const response = await fetch(apiUrl('/health'));
  const data = await response.json();
  return data.status === 'ok';
}

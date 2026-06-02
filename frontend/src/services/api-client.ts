import { API_BASE_URL, LOCAL_API_BASE_URL } from '@/constants/config';

/** Build an absolute URL against the configured backend. */
export const apiUrl = (path: string) => `${API_BASE_URL}${path}`;

/** Build an absolute URL against the local fallback backend. */
export const localApiUrl = (path: string) => `${LOCAL_API_BASE_URL}${path}`;

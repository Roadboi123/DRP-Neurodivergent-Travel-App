let activeToken: string | null = null;
let onUnauthorizedCallback: (() => void) | null = null;

export const authStore = {
  setToken(token: string | null) {
    activeToken = token;
  },
  getToken(): string | null {
    return activeToken;
  },
  onUnauthorized(callback: () => void) {
    onUnauthorizedCallback = callback;
  },
  triggerUnauthorized() {
    if (onUnauthorizedCallback) {
      onUnauthorizedCallback();
    }
  },
};

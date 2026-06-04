let activeToken: string | null = null;

export const authStore = {
  setToken(token: string | null) {
    activeToken = token;
  },
  getToken(): string | null {
    return activeToken;
  },
};

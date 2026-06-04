import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { authStore } from '@/services/auth-store';

export interface AuthContextType {
  username: string;
  token: string | null;
  isLoggedIn: boolean;
  login: (username: string, token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const STORAGE_USERNAME_KEY = 'roadboi_username';
const STORAGE_TOKEN_KEY = 'roadboi_token';

const isWeb = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

function getStoredValue(key: string): string {
  if (isWeb) {
    try {
      return window.localStorage.getItem(key) || '';
    } catch (e) {
      console.warn('Failed to read from localStorage:', e);
    }
  }
  return '';
}

function setStoredValue(key: string, value: string) {
  if (isWeb) {
    try {
      if (value) {
        window.localStorage.setItem(key, value);
      } else {
        window.localStorage.removeItem(key);
      }
    } catch (e) {
      console.warn('Failed to write to localStorage:', e);
    }
  }
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [username, setUsername] = useState<string>('');
  const [token, setToken] = useState<string | null>(null);

  // Load session from storage on mount
  useEffect(() => {
    const storedUser = getStoredValue(STORAGE_USERNAME_KEY);
    const storedToken = getStoredValue(STORAGE_TOKEN_KEY);
    
    if (storedUser && storedToken) {
      setUsername(storedUser);
      setToken(storedToken);
      authStore.setToken(storedToken);
    }
  }, []);

  const login = (name: string, sessionToken: string) => {
    const trimmedUser = name.trim();
    const trimmedToken = sessionToken.trim();
    
    setUsername(trimmedUser);
    setToken(trimmedToken);
    authStore.setToken(trimmedToken);
    
    setStoredValue(STORAGE_USERNAME_KEY, trimmedUser);
    setStoredValue(STORAGE_TOKEN_KEY, trimmedToken);
  };

  const logout = () => {
    setUsername('');
    setToken(null);
    authStore.setToken(null);
    
    setStoredValue(STORAGE_USERNAME_KEY, '');
    setStoredValue(STORAGE_TOKEN_KEY, '');
  };

  const isLoggedIn = username.length > 0 && token !== null;

  return (
    <AuthContext.Provider value={{ username, token, isLoggedIn, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

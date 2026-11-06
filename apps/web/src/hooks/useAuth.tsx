import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { AuthResponse, LoginInput, SignupInput, UserDto } from '@pinpoint/shared';
import { apiGet, apiPost, tokenStore } from '../lib/api';
import { connectSocket, disconnectSocket } from '../lib/socket';
import { queryKeys } from '../lib/query';

interface AuthContextValue {
  user: UserDto | null;
  loading: boolean;
  signup: (input: SignupInput) => Promise<void>;
  login: (input: LoginInput) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [hasToken, setHasToken] = useState<boolean>(() => Boolean(tokenStore.get()));
  const queryClient = useQueryClient();

  const meQuery = useQuery({
    queryKey: queryKeys.me,
    queryFn: () => apiGet<UserDto>('/auth/me'),
    enabled: hasToken,
    retry: false,
  });

  useEffect(() => {
    if (hasToken) connectSocket();
  }, [hasToken]);

  useEffect(() => {
    if (meQuery.error) {
      tokenStore.clear();
      setHasToken(false);
      disconnectSocket();
    }
  }, [meQuery.error]);

  const adopt = useCallback(
    (result: AuthResponse) => {
      tokenStore.set(result.token);
      queryClient.setQueryData(queryKeys.me, result.user);
      setHasToken(true);
      connectSocket();
    },
    [queryClient],
  );

  const signup = useCallback(
    async (input: SignupInput) => adopt(await apiPost<AuthResponse>('/auth/signup', input)),
    [adopt],
  );

  const login = useCallback(
    async (input: LoginInput) => adopt(await apiPost<AuthResponse>('/auth/login', input)),
    [adopt],
  );

  const logout = useCallback(() => {
    tokenStore.clear();
    queryClient.clear();
    disconnectSocket();
    setHasToken(false);
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: meQuery.data ?? null,
      loading: hasToken && meQuery.isLoading,
      signup,
      login,
      logout,
    }),
    [hasToken, login, logout, meQuery.data, meQuery.isLoading, signup],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

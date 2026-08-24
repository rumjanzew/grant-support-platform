import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

import { tokenStorage } from "./tokenStorage";

const baseURL = import.meta.env.VITE_API_BASE_URL || "/api";

export const apiClient = axios.create({ baseURL });

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const access = tokenStorage.getAccess();
  if (access) config.headers.Authorization = `Bearer ${access}`;
  return config;
});

type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean };
let refreshRequest: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refresh = tokenStorage.getRefresh();
  if (!refresh) throw new Error("Refresh token is missing");
  const response = await axios.post<{ access: string }>(`${baseURL}/auth/refresh/`, {
    refresh,
  });
  tokenStorage.setAccess(response.data.access);
  return response.data.access;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetryConfig | undefined;
    const skipsRefresh = ["/auth/login/", "/auth/register/", "/auth/refresh/", "/auth/logout/"].some(
      (path) => config?.url?.includes(path),
    );
    if (error.response?.status === 401 && config && !config._retry && !skipsRefresh) {
      config._retry = true;
      try {
        refreshRequest ??= refreshAccessToken().finally(() => {
          refreshRequest = null;
        });
        const access = await refreshRequest;
        config.headers.Authorization = `Bearer ${access}`;
        return apiClient(config);
      } catch {
        tokenStorage.clear();
        window.dispatchEvent(new Event("auth:unauthorized"));
      }
    }
    return Promise.reject(error);
  },
);

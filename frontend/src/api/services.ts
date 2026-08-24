import { apiClient } from "./client";
import type {
  Application,
  Attachment,
  CurrentUser,
  Grant,
  OrganizationInput,
  PaginatedResponse,
} from "../types";

export interface LoginResponse {
  access: string;
  refresh: string;
}

export const authApi = {
  register: (data: Record<string, unknown>) => apiClient.post("/auth/register/", data),
  login: (email: string, password: string) =>
    apiClient.post<LoginResponse>("/auth/login/", { email, password }),
  me: () => apiClient.get<CurrentUser>("/auth/me/"),
  logout: (refresh: string) => apiClient.post("/auth/logout/", { refresh }),
};

export interface GrantParams {
  page?: number;
  page_size?: number;
  search?: string;
  status?: string;
  category?: string;
  ordering?: string;
  deadline_from?: string;
  deadline_to?: string;
}

export const grantsApi = {
  list: (params: GrantParams = {}) =>
    apiClient.get<PaginatedResponse<Grant>>("/grants/", { params }),
  detail: (id: string) => apiClient.get<Grant>(`/grants/${id}/`),
};

export interface ApplicationInput {
  grant: string;
  project_name: string;
  description: string;
  requested_amount: string;
}

export const applicationsApi = {
  list: () => apiClient.get<Application[]>("/applications/"),
  detail: (id: string) => apiClient.get<Application>(`/applications/${id}/`),
  create: (data: ApplicationInput) => apiClient.post<Application>("/applications/", data),
  update: (id: string, data: Partial<ApplicationInput>) =>
    apiClient.patch<Application>(`/applications/${id}/`, data),
  submit: (id: string) => apiClient.post<Application>(`/applications/${id}/submit/`),
  attachments: (id: string) =>
    apiClient.get<Attachment[]>(`/applications/${id}/attachments/`),
  upload: (id: string, file: File) => {
    const data = new FormData();
    data.append("file", file);
    return apiClient.post<Attachment>(`/applications/${id}/attachments/`, data);
  },
  deleteAttachment: (applicationId: string, attachmentId: string) =>
    apiClient.delete(`/applications/${applicationId}/attachments/${attachmentId}/`),
};

export const organizationsApi = {
  create: (data: OrganizationInput) => apiClient.post("/organizations/", data),
};

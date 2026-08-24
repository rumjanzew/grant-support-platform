import { apiClient } from "./client";
import type {
  Application,
  AdministratorApplication,
  AdministratorDashboard,
  Attachment,
  CurrentUser,
  ExpertAssignment,
  ExpertDashboard,
  ExpertDecision,
  Grant,
  OrganizationInput,
  PaginatedResponse,
  UserSummary,
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
  requestPasswordReset: (email: string) =>
    apiClient.post<{ detail: string }>("/auth/password-reset/", { email }),
  confirmPasswordReset: (data: {
    uid: string;
    token: string;
    password: string;
    password_confirm: string;
  }) => apiClient.post<{ detail: string }>("/auth/password-reset/confirm/", data),
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
  create: (data: Omit<Grant, "id" | "created_by" | "created_at" | "updated_at">) =>
    apiClient.post<Grant>("/grants/", data),
  update: (id: string, data: Partial<Grant>) => apiClient.patch<Grant>(`/grants/${id}/`, data),
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

export interface ListParams {
  page?: number;
  page_size?: number;
  search?: string;
  status?: string;
  role?: string;
  ordering?: string;
}

export const administratorApi = {
  dashboard: () => apiClient.get<AdministratorDashboard>("/admin/dashboard/"),
  applications: (params: ListParams = {}) =>
    apiClient.get<PaginatedResponse<AdministratorApplication>>("/admin/applications/", { params }),
  assignExpert: (applicationId: string, expertId: string) =>
    apiClient.post<ExpertAssignment>(`/admin/applications/${applicationId}/assign-expert/`, {
      expert_id: expertId,
    }),
  users: (params: ListParams = {}) =>
    apiClient.get<PaginatedResponse<UserSummary>>("/admin/users/", { params }),
};

export const expertApi = {
  dashboard: () => apiClient.get<ExpertDashboard>("/expert/dashboard/"),
  assignments: (params: ListParams = {}) =>
    apiClient.get<PaginatedResponse<ExpertAssignment>>("/expert/assignments/", { params }),
  assignment: (id: string) => apiClient.get<ExpertAssignment>(`/expert/assignments/${id}/`),
  saveReport: (id: string, data: { score: number | null; comment: string }) =>
    apiClient.patch(`/expert/assignments/${id}/report/`, data),
  decide: (id: string, data: { score: number; comment: string; decision: ExpertDecision }) =>
    apiClient.post(`/expert/assignments/${id}/decision/`, data),
};

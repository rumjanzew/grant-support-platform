export type UserRole = "Applicant" | "Expert" | "Administrator";

export interface CurrentUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  middle_name: string;
  phone: string;
  role: UserRole;
  status: "ACTIVE" | "BLOCKED";
  organization: string | null;
  consent_pd_agreed_at: string;
  created_at: string;
}

export type GrantStatus = "DRAFT" | "PUBLISHED" | "OPEN" | "CLOSED" | "ARCHIVED";

export interface Grant {
  id: string;
  code: string;
  title: string;
  description: string;
  category: string;
  start_date: string;
  end_date: string;
  max_amount: string;
  status: GrantStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export type ApplicationStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "REVISION_REQUIRED"
  | "REVISION_SUBMITTED"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

export interface Application {
  id: string;
  application_number: string | null;
  organization: string;
  grant: string;
  project_name: string;
  description: string;
  requested_amount: string;
  status: ApplicationStatus;
  version: number;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  review_deadline: string | null;
}

export interface Attachment {
  id: string;
  application: string;
  original_name: string;
  stored_name: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  sha256: string;
  uploaded_by: string;
  uploaded_at: string;
}

export interface OrganizationInput {
  name: string;
  inn: string;
  kpp: string;
  ogrn: string;
  organization_type: string;
  registration_date?: string;
  city: string;
  street: string;
  house: string;
  postal_code: string;
}

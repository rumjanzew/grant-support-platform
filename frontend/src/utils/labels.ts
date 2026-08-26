import type { UserRole } from "../types";

export const roleLabels: Record<UserRole, string> = {
  Applicant: "Заявитель",
  Expert: "Эксперт",
  Administrator: "Администратор",
};

export const statusLabels: Record<string, string> = {
  DRAFT: "Черновик",
  PUBLISHED: "Опубликован",
  OPEN: "Приём заявок",
  CLOSED: "Закрыт",
  ARCHIVED: "В архиве",
  SUBMITTED: "Подана",
  REVISION_SUBMITTED: "Повторно подана",
  UNDER_REVIEW: "На рассмотрении",
  REVISION_REQUIRED: "Требуется доработка",
  APPROVED: "Одобрена",
  REJECTED: "Отклонена",
  CANCELLED: "Отменена",
  ACTIVE: "Активен",
  BLOCKED: "Заблокирован",
  COMPLETED: "Завершено",
};

export function getRoleLabel(role: UserRole): string {
  return roleLabels[role];
}

export function getStatusLabel(status: string): string {
  return statusLabels[status] ?? status;
}

export const organizationStatusLabels: Record<string, string> = {
  ACTIVE: "Активна",
  BLOCKED: "Заблокирована",
};

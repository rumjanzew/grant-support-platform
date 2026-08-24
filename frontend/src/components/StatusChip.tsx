import { Chip, type ChipProps } from "@mui/material";

const labels: Record<string, string> = {
  DRAFT: "Черновик",
  PUBLISHED: "Опубликован",
  OPEN: "Приём заявок",
  CLOSED: "Закрыт",
  ARCHIVED: "В архиве",
  SUBMITTED: "Отправлена",
  UNDER_REVIEW: "На рассмотрении",
  REVISION_REQUIRED: "Требуется доработка",
  REVISION_SUBMITTED: "Доработка отправлена",
  APPROVED: "Одобрена",
  REJECTED: "Отклонена",
  CANCELLED: "Отменена",
};

const colors: Record<string, ChipProps["color"]> = {
  OPEN: "success",
  APPROVED: "success",
  REJECTED: "error",
  REVISION_REQUIRED: "warning",
  UNDER_REVIEW: "info",
  SUBMITTED: "info",
};

export function StatusChip({ status }: { status: string }) {
  return <Chip size="small" label={labels[status] ?? status} color={colors[status] ?? "default"} />;
}

import { Chip } from "@mui/material";

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

const styles: Record<string, { color: string; backgroundColor: string; borderColor: string }> = {
  DRAFT: { color: "#52646c", backgroundColor: "#edf1f2", borderColor: "#d8e0e3" },
  PUBLISHED: { color: "#315e78", backgroundColor: "#e8f1f6", borderColor: "#c9dde8" },
  OPEN: { color: "#236048", backgroundColor: "#e3f2ea", borderColor: "#bfddce" },
  CLOSED: { color: "#675a4d", backgroundColor: "#f1ece7", borderColor: "#ddd2c8" },
  ARCHIVED: { color: "#62686c", backgroundColor: "#eff1f2", borderColor: "#d7dcde" },
  SUBMITTED: { color: "#285e82", backgroundColor: "#e4f0f7", borderColor: "#c1d9e7" },
  UNDER_REVIEW: { color: "#594c8d", backgroundColor: "#eeeafb", borderColor: "#d5cef0" },
  REVISION_REQUIRED: { color: "#865410", backgroundColor: "#fff1d9", borderColor: "#efd09c" },
  REVISION_SUBMITTED: { color: "#315e78", backgroundColor: "#e8f1f6", borderColor: "#c9dde8" },
  APPROVED: { color: "#236048", backgroundColor: "#e3f2ea", borderColor: "#bfddce" },
  REJECTED: { color: "#8c3636", backgroundColor: "#fae8e8", borderColor: "#eabebe" },
  CANCELLED: { color: "#62686c", backgroundColor: "#eff1f2", borderColor: "#d7dcde" },
};

export function StatusChip({ status }: { status: string }) {
  return <Chip size="small" variant="outlined" label={labels[status] ?? status} sx={styles[status]} />;
}

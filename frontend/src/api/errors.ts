import axios from "axios";

const codeMessages: Record<string, string> = {
  APPLICATION_PERIOD_ENDED: "Срок подачи заявок по гранту завершён.",
  APPLICATION_PERIOD_NOT_STARTED: "Приём заявок ещё не начался.",
  INVALID_APPLICATION_STATUS: "Действие недоступно для текущего статуса заявки.",
  FILE_TOO_LARGE: "Файл превышает допустимый размер 10 МБ.",
  FILE_LIMIT_EXCEEDED: "К заявке можно прикрепить не более пяти файлов.",
  TOTAL_FILE_SIZE_EXCEEDED: "Общий размер документов превышает 50 МБ.",
  GRANT_NOT_OPEN: "Грант сейчас не принимает заявки.",
  INVALID_EXPERT: "Выберите активного пользователя с ролью эксперта.",
  INVALID_ASSIGNMENT_STATUS: "Экспертное назначение уже завершено.",
  INVALID_EXPERT_DECISION: "Выберите допустимое экспертное решение.",
  SCORE_REQUIRED: "Для решения необходимо указать оценку.",
  COMMENT_REQUIRED: "Для решения необходимо добавить комментарий.",
};

export function getApiErrorMessage(error: unknown): string {
  if (!axios.isAxiosError(error)) return "Произошла непредвиденная ошибка.";
  const data = error.response?.data;
  if (!data) return "Не удалось связаться с сервером. Попробуйте ещё раз позже.";
  if (typeof data === "string") return data;
  if (typeof data.code === "string" && codeMessages[data.code]) return codeMessages[data.code];
  if (typeof data.detail === "string") return data.detail;
  for (const value of Object.values(data as Record<string, unknown>)) {
    if (typeof value === "string") return value;
    if (Array.isArray(value) && value.length) return String(value[0]);
  }
  return "Сервер отклонил запрос. Проверьте введённые данные.";
}

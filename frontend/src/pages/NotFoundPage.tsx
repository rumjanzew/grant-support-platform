import { ErrorStatePage } from "../components/ErrorStatePage";

export function NotFoundPage() {
  return (
    <ErrorStatePage code="404" title="Страница не найдена" description="Возможно, адрес изменился или страница была удалена." />
  );
}

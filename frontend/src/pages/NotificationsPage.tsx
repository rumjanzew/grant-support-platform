import DoneAllOutlinedIcon from "@mui/icons-material/DoneAllOutlined";
import { Alert, Button, List, ListItemButton, Pagination, Paper, Stack, Typography } from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getApiErrorMessage } from "../api/errors";
import { notificationsApi } from "../api/services";
import { useAuth } from "../auth/AuthContext";
import { EmptyState } from "../components/EmptyState";
import { LoadingState } from "../components/LoadingState";
import { notificationTarget } from "../components/NotificationBell";
import { PageHeader } from "../components/PageHeader";
import { useNotificationCenter } from "../notifications/NotificationCenterContext";
import type { PaginatedResponse, UserNotification } from "../types";
import { formatDateTime } from "../utils/date";

export function NotificationsPage() {
  const { user } = useAuth();
  const { markRead, markAllRead } = useNotificationCenter();
  const navigate = useNavigate();
  const [data, setData] = useState<PaginatedResponse<UserNotification> | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData((await notificationsApi.list({ page, page_size: 10 })).data);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { void load(); }, [load]);

  const openNotification = async (notification: UserNotification) => {
    try {
      if (!notification.is_read) {
        await markRead(notification.id);
        setData((current) => current ? {
          ...current,
          results: current.results.map((item) => item.id === notification.id ? { ...item, is_read: true } : item),
        } : current);
      }
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
      return;
    }
    const target = user ? notificationTarget(notification, user.role) : null;
    if (target) navigate(target);
  };

  const readAll = async () => {
    setBusy(true);
    try {
      await markAllRead();
      setData((current) => current ? {
        ...current,
        results: current.results.map((item) => ({ ...item, is_read: true })),
      } : current);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Уведомления"
        subtitle="Значимые события по заявкам и экспертизе"
        action={data?.results.some((item) => !item.is_read) ? (
          <Button variant="outlined" startIcon={<DoneAllOutlinedIcon />} disabled={busy} onClick={() => void readAll()}>
            Отметить все как прочитанные
          </Button>
        ) : undefined}
      />
      {error && <Alert severity="error" action={<Button color="inherit" onClick={() => void load()}>Повторить</Button>}>{error}</Alert>}
      {loading ? <LoadingState /> : !data?.results.length ? (
        <EmptyState title="Уведомлений пока нет" description="Здесь появятся важные события по вашим заявкам." />
      ) : (
        <>
          <Paper variant="outlined">
            <List disablePadding>
              {data.results.map((notification) => (
                <ListItemButton
                  key={notification.id}
                  divider
                  onClick={() => void openNotification(notification)}
                  sx={{ alignItems: "flex-start", py: 2, px: { xs: 2, sm: 3 }, backgroundColor: notification.is_read ? "transparent" : "primary.light" }}
                >
                  <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                    <Typography fontWeight={notification.is_read ? 650 : 800}>{notification.title}</Typography>
                    <Typography color="text.secondary">{notification.message}</Typography>
                    <Typography variant="caption" color="text.secondary">{formatDateTime(notification.created_at)}</Typography>
                  </Stack>
                </ListItemButton>
              ))}
            </List>
          </Paper>
          {data.count > 10 && <Stack alignItems="center" sx={{ mt: 3 }}><Pagination page={page} count={Math.ceil(data.count / 10)} onChange={(_, value) => setPage(value)} /></Stack>}
        </>
      )}
    </>
  );
}

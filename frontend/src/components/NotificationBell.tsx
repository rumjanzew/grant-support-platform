import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import {
  Badge,
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { getApiErrorMessage } from "../api/errors";
import { notificationsApi } from "../api/services";
import { useAuth } from "../auth/AuthContext";
import { useNotificationCenter } from "../notifications/NotificationCenterContext";
import type { UserNotification } from "../types";
import { formatDateTime } from "../utils/date";

export function notificationTarget(notification: UserNotification, role: string) {
  if (!notification.application) return null;
  if (role === "Applicant") return `/applications/${notification.application}`;
  if (role === "Expert") {
    return notification.assignment_id
      ? `/expert/assignments/${notification.assignment_id}`
      : "/expert/assignments";
  }
  if (role === "Administrator") return "/admin/applications";
  return null;
}

export function NotificationBell() {
  const { user } = useAuth();
  const { unreadCount, refreshUnread, markRead } = useNotificationCenter();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [items, setItems] = useState<UserNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!user) return null;

  const openMenu = async (element: HTMLElement) => {
    setAnchorEl(element);
    setLoading(true);
    setError("");
    try {
      const response = await notificationsApi.list({ page_size: 5 });
      setItems(response.data.results);
      await refreshUnread();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };

  const openNotification = async (notification: UserNotification) => {
    try {
      if (!notification.is_read) {
        await markRead(notification.id);
        setItems((current) => current.map((item) => (
          item.id === notification.id ? { ...item, is_read: true } : item
        )));
      }
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
      return;
    }
    setAnchorEl(null);
    const target = notificationTarget(notification, user.role);
    if (target) navigate(target);
  };

  return (
    <>
      <Tooltip title="Уведомления">
        <IconButton
          color="inherit"
          aria-label="Уведомления"
          onClick={(event) => void openMenu(event.currentTarget)}
          sx={{ mr: { xs: 0.25, sm: 0.75 } }}
        >
          <Badge badgeContent={unreadCount} color="error" max={99} invisible={!unreadCount}>
            <NotificationsNoneOutlinedIcon />
          </Badge>
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        slotProps={{ paper: { sx: { width: { xs: "calc(100vw - 24px)", sm: 390 }, maxWidth: 390, mt: 1 } } }}
      >
        <Box sx={{ px: 2, py: 1 }}>
          <Typography fontWeight={750}>Уведомления</Typography>
        </Box>
        <Divider />
        {loading ? (
          <Box sx={{ display: "grid", placeItems: "center", minHeight: 120 }}><CircularProgress size={28} /></Box>
        ) : error ? (
          <Typography color="error" variant="body2" sx={{ px: 2, py: 2 }}>{error}</Typography>
        ) : !items.length ? (
          <Typography color="text.secondary" variant="body2" sx={{ px: 2, py: 3, textAlign: "center" }}>Уведомлений пока нет</Typography>
        ) : items.map((notification) => (
          <MenuItem
            key={notification.id}
            onClick={() => void openNotification(notification)}
            sx={{ alignItems: "flex-start", py: 1.5, whiteSpace: "normal", backgroundColor: notification.is_read ? "transparent" : "primary.light" }}
          >
            <Stack spacing={0.25} sx={{ minWidth: 0 }}>
              <Typography variant="body2" fontWeight={notification.is_read ? 600 : 800}>{notification.title}</Typography>
              <Typography variant="body2" color="text.secondary">{notification.message}</Typography>
              <Typography variant="caption" color="text.secondary">{formatDateTime(notification.created_at)}</Typography>
            </Stack>
          </MenuItem>
        ))}
        <Divider />
        <Box sx={{ p: 1 }}>
          <Button fullWidth onClick={() => { setAnchorEl(null); navigate("/notifications"); }}>Все уведомления</Button>
        </Box>
      </Menu>
    </>
  );
}

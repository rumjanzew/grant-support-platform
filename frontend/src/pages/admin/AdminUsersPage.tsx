import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import LockOpenOutlinedIcon from "@mui/icons-material/LockOpenOutlined";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Pagination,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";

import { getApiErrorMessage } from "../../api/errors";
import { administratorApi } from "../../api/services";
import { useAuth } from "../../auth/AuthContext";
import { EmptyState } from "../../components/EmptyState";
import { LoadingState } from "../../components/LoadingState";
import { PageHeader } from "../../components/PageHeader";
import { StatusChip } from "../../components/StatusChip";
import { useNotify } from "../../notifications/NotificationContext";
import type { PaginatedResponse, UserRole, UserSummary } from "../../types";
import { formatDateTime } from "../../utils/date";
import { getRoleLabel } from "../../utils/labels";

const userRoles: UserRole[] = ["Applicant", "Expert", "Administrator"];
type EditableRole = "Applicant" | "Expert";
type PendingAction = { type: "role" | "block" | "unblock"; user: UserSummary } | null;

export function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const notify = useNotify();
  const [data, setData] = useState<PaginatedResponse<UserSummary> | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [userStatus, setUserStatus] = useState("");
  const [filters, setFilters] = useState({ search: "", role: "", status: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [nextRole, setNextRole] = useState<EditableRole>("Expert");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData((await administratorApi.users({ page, page_size: 10, ...filters })).data);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => { void load(); }, [load]);

  const replaceUser = (updated: UserSummary) => {
    setData((current) => current ? {
      ...current,
      results: current.results.map((item) => item.id === updated.id ? updated : item),
    } : current);
  };

  const openRoleDialog = (user: UserSummary) => {
    setNextRole(user.role === "Applicant" ? "Expert" : "Applicant");
    setActionError("");
    setPendingAction({ type: "role", user });
  };

  const confirmAction = async () => {
    if (!pendingAction) return;
    setBusy(true);
    setActionError("");
    try {
      const response = pendingAction.type === "role"
        ? await administratorApi.changeUserRole(pendingAction.user.id, nextRole)
        : pendingAction.type === "block"
          ? await administratorApi.blockUser(pendingAction.user.id)
          : await administratorApi.unblockUser(pendingAction.user.id);
      replaceUser(response.data);
      notify(
        pendingAction.type === "role"
          ? "Роль пользователя изменена."
          : pendingAction.type === "block"
            ? "Пользователь заблокирован."
            : "Пользователь разблокирован.",
      );
      setPendingAction(null);
    } catch (requestError) {
      setActionError(getApiErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  };

  const dialogTitle = pendingAction?.type === "role"
    ? "Изменить роль пользователя?"
    : pendingAction?.type === "block"
      ? "Заблокировать пользователя?"
      : "Разблокировать пользователя?";

  return (
    <>
      <PageHeader title="Пользователи" subtitle="Роли и доступ зарегистрированных пользователей" />
      <Paper component="form" variant="outlined" sx={{ p: 2, mb: 3 }} onSubmit={(event) => { event.preventDefault(); setPage(1); setFilters({ search, role, status: userStatus }); }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <TextField fullWidth size="small" label="Поиск по имени или email" value={search} onChange={(event) => setSearch(event.target.value)} />
          <TextField select size="small" label="Роль" value={role} onChange={(event) => setRole(event.target.value)} sx={{ minWidth: 170 }}><MenuItem value="">Все</MenuItem>{userRoles.map((item) => <MenuItem key={item} value={item}>{getRoleLabel(item)}</MenuItem>)}</TextField>
          <TextField select size="small" label="Статус" value={userStatus} onChange={(event) => setUserStatus(event.target.value)} sx={{ minWidth: 170 }}><MenuItem value="">Все</MenuItem><MenuItem value="ACTIVE">Активен</MenuItem><MenuItem value="BLOCKED">Заблокирован</MenuItem></TextField>
          <Button type="submit" variant="outlined">Найти</Button>
        </Stack>
      </Paper>
      {error && <Alert severity="error" action={<Button color="inherit" onClick={() => void load()}>Повторить</Button>}>{error}</Alert>}
      {loading ? <LoadingState /> : !data?.results.length ? <EmptyState title="Пользователи не найдены" description="Измените параметры поиска." /> : (
        <>
          <TableContainer component={Paper} variant="outlined" sx={{ maxWidth: "100%" }}>
            <Table sx={{ minWidth: 920 }}>
              <TableHead><TableRow><TableCell>Пользователь</TableCell><TableCell>Роль</TableCell><TableCell>Статус</TableCell><TableCell>Регистрация</TableCell><TableCell align="right">Действия</TableCell></TableRow></TableHead>
              <TableBody>{data.results.map((user) => {
                const isSelf = user.id === currentUser?.id;
                const roleDisabled = isSelf || user.role === "Administrator";
                const restriction = isSelf ? "Нельзя изменять собственную учётную запись" : "Роль администратора изменяется через Django Admin";
                return <TableRow key={user.id} hover>
                  <TableCell><Typography fontWeight={700}>{[user.last_name, user.first_name, user.middle_name].filter(Boolean).join(" ") || "Без имени"}</Typography><Typography variant="body2" color="text.secondary">{user.email}</Typography></TableCell>
                  <TableCell>{getRoleLabel(user.role)}</TableCell>
                  <TableCell><StatusChip status={user.status} /></TableCell>
                  <TableCell>{formatDateTime(user.created_at)}</TableCell>
                  <TableCell align="right"><Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Tooltip title={roleDisabled ? restriction : "Изменить роль"}><span><Button size="small" startIcon={<EditOutlinedIcon />} disabled={roleDisabled} onClick={() => openRoleDialog(user)}>Роль</Button></span></Tooltip>
                    <Tooltip title={isSelf ? "Нельзя блокировать собственную учётную запись" : ""}><span><Button size="small" color={user.status === "BLOCKED" ? "success" : "error"} startIcon={user.status === "BLOCKED" ? <LockOpenOutlinedIcon /> : <BlockOutlinedIcon />} disabled={isSelf} onClick={() => { setActionError(""); setPendingAction({ type: user.status === "BLOCKED" ? "unblock" : "block", user }); }}>{user.status === "BLOCKED" ? "Разблокировать" : "Заблокировать"}</Button></span></Tooltip>
                  </Stack></TableCell>
                </TableRow>;
              })}</TableBody>
            </Table>
          </TableContainer>
          {data.count > 10 && <Stack alignItems="center" sx={{ mt: 3 }}><Pagination page={page} count={Math.ceil(data.count / 10)} onChange={(_, value) => setPage(value)} /></Stack>}
        </>
      )}
      <Dialog open={Boolean(pendingAction)} onClose={() => !busy && setPendingAction(null)} fullWidth maxWidth="xs">
        <DialogTitle>{dialogTitle}</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary" sx={{ mb: pendingAction?.type === "role" ? 2 : 0 }}>{[pendingAction?.user.last_name, pendingAction?.user.first_name].filter(Boolean).join(" ") || pendingAction?.user.email}</Typography>
          {pendingAction?.type === "role" && <TextField select fullWidth label="Новая роль" value={nextRole} onChange={(event) => setNextRole(event.target.value as EditableRole)}><MenuItem value="Applicant">Заявитель</MenuItem><MenuItem value="Expert">Эксперт</MenuItem></TextField>}
          {actionError && <Alert severity="error" sx={{ mt: 2 }}>{actionError}</Alert>}
        </DialogContent>
        <DialogActions><Button onClick={() => setPendingAction(null)} disabled={busy}>Отмена</Button><Button variant="contained" color={pendingAction?.type === "block" ? "error" : "primary"} onClick={() => void confirmAction()} disabled={busy}>{busy ? "Сохраняем…" : "Подтвердить"}</Button></DialogActions>
      </Dialog>
    </>
  );
}

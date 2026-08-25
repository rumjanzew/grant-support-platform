import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import { Alert, Button, Card, CardActions, CardContent, Grid, MenuItem, Pagination, Paper, Stack, TextField, Typography } from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";

import { getApiErrorMessage } from "../../api/errors";
import { grantsApi } from "../../api/services";
import { EmptyState } from "../../components/EmptyState";
import { LoadingState } from "../../components/LoadingState";
import { PageHeader } from "../../components/PageHeader";
import { StatusChip } from "../../components/StatusChip";
import type { Grant, GrantStatus, PaginatedResponse } from "../../types";
import { getStatusLabel } from "../../utils/labels";

const grantStatuses: GrantStatus[] = ["DRAFT", "PUBLISHED", "OPEN", "CLOSED", "ARCHIVED"];

export function AdminGrantsPage() {
  const [data, setData] = useState<PaginatedResponse<Grant> | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusValue, setStatusValue] = useState("");
  const [query, setQuery] = useState({ search: "", status: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => { setLoading(true); setError(""); try { setData((await grantsApi.list({ page, page_size: 10, ...query })).data); } catch (requestError) { setError(getApiErrorMessage(requestError)); } finally { setLoading(false); } }, [page, query]);
  useEffect(() => { void load(); }, [load]);
  return <>
    <PageHeader title="Управление грантами" subtitle="Создание и редактирование грантовых программ" action={<Button component={RouterLink} to="/admin/grants/new" startIcon={<AddIcon />} variant="contained">Создать грант</Button>} />
    <Paper component="form" variant="outlined" sx={{ p: 2, mb: 3 }} onSubmit={(event) => { event.preventDefault(); setPage(1); setQuery({ search, status: statusValue }); }}><Grid container spacing={2}><Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth size="small" label="Поиск" value={search} onChange={(event) => setSearch(event.target.value)} /></Grid><Grid size={{ xs: 7, sm: 3 }}><TextField select fullWidth size="small" label="Статус" value={statusValue} onChange={(event) => setStatusValue(event.target.value)}><MenuItem value="">Все</MenuItem>{grantStatuses.map((item) => <MenuItem key={item} value={item}>{getStatusLabel(item)}</MenuItem>)}</TextField></Grid><Grid size={{ xs: 5, sm: 3 }}><Button fullWidth type="submit" variant="outlined">Найти</Button></Grid></Grid></Paper>
    {error && <Alert severity="error" action={<Button color="inherit" onClick={load}>Повторить</Button>}>{error}</Alert>}
    {loading ? <LoadingState /> : !data?.results.length ? <EmptyState title="Грантов нет" description="Создайте первый грант или измените параметры поиска." /> : <><Grid container spacing={2}>{data.results.map((grant) => <Grid key={grant.id} size={{ xs: 12, md: 6 }}><Card variant="outlined"><CardContent><Stack direction="row" justifyContent="space-between" gap={2}><Typography variant="overline">{grant.code}</Typography><StatusChip status={grant.status} /></Stack><Typography variant="h6" sx={{ mt: 1 }}>{grant.title}</Typography><Typography color="text.secondary">{grant.category}</Typography></CardContent><CardActions><Button component={RouterLink} to={`/admin/grants/${grant.id}/edit`} startIcon={<EditIcon />}>Редактировать</Button><Button component={RouterLink} to={`/grants/${grant.id}`}>Открыть</Button></CardActions></Card></Grid>)}</Grid>{data.count > 10 && <Stack alignItems="center" sx={{ mt: 3 }}><Pagination page={page} count={Math.ceil(data.count / 10)} onChange={(_, value) => setPage(value)} /></Stack>}</>}
  </>;
}

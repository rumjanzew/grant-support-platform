import { Alert, Button, MenuItem, Pagination, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { useCallback, useEffect, useState } from "react";

import { getApiErrorMessage } from "../../api/errors";
import { administratorApi } from "../../api/services";
import { EmptyState } from "../../components/EmptyState";
import { LoadingState } from "../../components/LoadingState";
import { PageHeader } from "../../components/PageHeader";
import type { PaginatedResponse, UserSummary } from "../../types";

export function AdminUsersPage() {
  const [data, setData] = useState<PaginatedResponse<UserSummary> | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [filters, setFilters] = useState({ search: "", role: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => { setLoading(true); setError(""); try { setData((await administratorApi.users({ page, page_size: 10, ...filters })).data); } catch (requestError) { setError(getApiErrorMessage(requestError)); } finally { setLoading(false); } }, [filters, page]);
  useEffect(() => { void load(); }, [load]);
  return <><PageHeader title="Пользователи" subtitle="Просмотр зарегистрированных пользователей и их ролей" /><Paper component="form" variant="outlined" sx={{ p: 2, mb: 3 }} onSubmit={(event) => { event.preventDefault(); setPage(1); setFilters({ search, role }); }}><Stack direction={{ xs: "column", sm: "row" }} spacing={2}><TextField fullWidth size="small" label="Поиск по имени или email" value={search} onChange={(event) => setSearch(event.target.value)} /><TextField select size="small" label="Роль" value={role} onChange={(event) => setRole(event.target.value)} sx={{ minWidth: 180 }}><MenuItem value="">Все</MenuItem><MenuItem value="Applicant">Applicant</MenuItem><MenuItem value="Expert">Expert</MenuItem><MenuItem value="Administrator">Administrator</MenuItem></TextField><Button type="submit" variant="outlined">Найти</Button></Stack></Paper>{error && <Alert severity="error" action={<Button color="inherit" onClick={load}>Повторить</Button>}>{error}</Alert>}{loading ? <LoadingState /> : !data?.results.length ? <EmptyState title="Пользователи не найдены" description="Измените параметры поиска." /> : <><TableContainer component={Paper} variant="outlined"><Table><TableHead><TableRow><TableCell>Пользователь</TableCell><TableCell>Роль</TableCell><TableCell>Организация</TableCell><TableCell>Статус</TableCell></TableRow></TableHead><TableBody>{data.results.map((user) => <TableRow key={user.id}><TableCell><Typography fontWeight={700}>{[user.last_name, user.first_name, user.middle_name].filter(Boolean).join(" ") || "Без имени"}</Typography><Typography variant="body2" color="text.secondary">{user.email}</Typography></TableCell><TableCell>{user.role}</TableCell><TableCell>{user.organization_name ?? "—"}</TableCell><TableCell>{user.status}</TableCell></TableRow>)}</TableBody></Table></TableContainer>{data.count > 10 && <Stack alignItems="center" sx={{ mt: 3 }}><Pagination page={page} count={Math.ceil(data.count / 10)} onChange={(_, value) => setPage(value)} /></Stack>}</>}</>;
}

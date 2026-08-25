import PersonAddIcon from "@mui/icons-material/PersonAdd";
import { Alert, Button, Card, CardActions, CardContent, Dialog, DialogActions, DialogContent, DialogTitle, Grid, MenuItem, Pagination, Paper, Stack, TextField, Typography } from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { getApiErrorMessage } from "../../api/errors";
import { administratorApi } from "../../api/services";
import { EmptyState } from "../../components/EmptyState";
import { LoadingState } from "../../components/LoadingState";
import { PageHeader } from "../../components/PageHeader";
import { StatusChip } from "../../components/StatusChip";
import { useNotify } from "../../notifications/NotificationContext";
import type { AdministratorApplication, ApplicationStatus, PaginatedResponse, UserSummary } from "../../types";
import { getStatusLabel } from "../../utils/labels";

const assignable = new Set(["SUBMITTED", "REVISION_SUBMITTED"]);
const applicationStatuses: ApplicationStatus[] = ["SUBMITTED", "REVISION_SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "REVISION_REQUIRED"];
const currency = new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB" });

export function AdminApplicationsPage() {
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<PaginatedResponse<AdministratorApplication> | null>(null);
  const [experts, setExperts] = useState<UserSummary[]>([]);
  const [selected, setSelected] = useState<AdministratorApplication | null>(null);
  const [expertId, setExpertId] = useState("");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusValue, setStatusValue] = useState(searchParams.get("status") ?? "");
  const [filters, setFilters] = useState({ search: "", status: searchParams.get("status") ?? "" });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const notify = useNotify();
  const load = useCallback(async () => { setLoading(true); setError(""); try { setData((await administratorApi.applications({ page, page_size: 10, ...filters })).data); } catch (requestError) { setError(getApiErrorMessage(requestError)); } finally { setLoading(false); } }, [filters, page]);
  useEffect(() => { void load(); }, [load]);
  const openAssignment = async (application: AdministratorApplication) => { setSelected(application); setExpertId(""); if (!experts.length) { try { setExperts((await administratorApi.users({ role: "Expert", status: "ACTIVE", page_size: 20 })).data.results); } catch (requestError) { notify(getApiErrorMessage(requestError), "error"); } } };
  const assign = async () => { if (!selected || !expertId) return; setBusy(true); try { await administratorApi.assignExpert(selected.id, expertId); notify("Эксперт назначен, заявка передана на рассмотрение."); setSelected(null); await load(); } catch (requestError) { notify(getApiErrorMessage(requestError), "error"); } finally { setBusy(false); } };
  return <>
    <PageHeader title="Заявки" subtitle="Назначение экспертов на отправленные заявки" />
    <Paper component="form" variant="outlined" sx={{ p: 2, mb: 3 }} onSubmit={(event) => { event.preventDefault(); setPage(1); setFilters({ search, status: statusValue }); }}><Grid container spacing={2}><Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth size="small" label="Номер, проект или организация" value={search} onChange={(event) => setSearch(event.target.value)} /></Grid><Grid size={{ xs: 7, sm: 3 }}><TextField select fullWidth size="small" label="Статус" value={statusValue} onChange={(event) => setStatusValue(event.target.value)}><MenuItem value="">Все</MenuItem>{applicationStatuses.map((item) => <MenuItem key={item} value={item}>{getStatusLabel(item)}</MenuItem>)}</TextField></Grid><Grid size={{ xs: 5, sm: 3 }}><Button fullWidth type="submit" variant="outlined">Применить</Button></Grid></Grid></Paper>
    {error && <Alert severity="error" action={<Button color="inherit" onClick={load}>Повторить</Button>}>{error}</Alert>}
    {loading ? <LoadingState /> : !data?.results.length ? <EmptyState title="Заявок нет" description="По выбранным условиям заявки не найдены." /> : <><Grid container spacing={2}>{data.results.map((application) => <Grid key={application.id} size={{ xs: 12, md: 6 }}><Card variant="outlined"><CardContent><Stack direction="row" justifyContent="space-between" gap={2}><Typography variant="overline">{application.application_number ?? "Без номера"}</Typography><StatusChip status={application.status} /></Stack><Typography variant="h6" sx={{ mt: 1 }}>{application.project_name}</Typography><Typography color="text.secondary">{application.organization_name} · {application.grant_title}</Typography><Typography sx={{ mt: 1 }}>{currency.format(Number(application.requested_amount))}</Typography>{application.assignment && <Alert severity={application.assignment.status === "ACTIVE" ? "info" : "success"} sx={{ mt: 2 }}>Эксперт: {application.assignment.expert_name}</Alert>}</CardContent>{assignable.has(application.status) && <CardActions><Button startIcon={<PersonAddIcon />} onClick={() => void openAssignment(application)}>Назначить эксперта</Button></CardActions>}</Card></Grid>)}</Grid>{data.count > 10 && <Stack alignItems="center" sx={{ mt: 3 }}><Pagination page={page} count={Math.ceil(data.count / 10)} onChange={(_, value) => setPage(value)} /></Stack>}</>}
    <Dialog open={Boolean(selected)} onClose={() => !busy && setSelected(null)} fullWidth maxWidth="sm"><DialogTitle>Назначить эксперта</DialogTitle><DialogContent><Typography color="text.secondary" sx={{ mb: 2 }}>{selected?.project_name}</Typography>{!experts.length ? <Alert severity="warning">Нет доступных активных экспертов.</Alert> : <TextField select fullWidth label="Эксперт" value={expertId} onChange={(event) => setExpertId(event.target.value)}>{experts.map((expert) => <MenuItem key={expert.id} value={expert.id}>{[expert.last_name, expert.first_name].filter(Boolean).join(" ") || expert.email} · {expert.email}</MenuItem>)}</TextField>}</DialogContent><DialogActions><Button onClick={() => setSelected(null)} disabled={busy}>Отмена</Button><Button variant="contained" onClick={() => void assign()} disabled={!expertId || busy}>{busy ? "Назначаем…" : "Назначить"}</Button></DialogActions></Dialog>
  </>;
}

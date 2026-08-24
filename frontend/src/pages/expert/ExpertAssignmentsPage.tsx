import { Alert, Button, Card, CardActionArea, CardContent, Grid, MenuItem, Pagination, Paper, Stack, TextField, Typography } from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";

import { getApiErrorMessage } from "../../api/errors";
import { expertApi } from "../../api/services";
import { EmptyState } from "../../components/EmptyState";
import { LoadingState } from "../../components/LoadingState";
import { PageHeader } from "../../components/PageHeader";
import { StatusChip } from "../../components/StatusChip";
import type { ExpertAssignment, PaginatedResponse } from "../../types";

const currency = new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB" });

export function ExpertAssignmentsPage() {
  const [data, setData] = useState<PaginatedResponse<ExpertAssignment> | null>(null);
  const [page, setPage] = useState(1);
  const [statusValue, setStatusValue] = useState("ACTIVE");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => { setLoading(true); setError(""); try { setData((await expertApi.assignments({ page, page_size: 10, status: statusValue })).data); } catch (requestError) { setError(getApiErrorMessage(requestError)); } finally { setLoading(false); } }, [page, statusValue]);
  useEffect(() => { void load(); }, [load]);
  return <><PageHeader title="Назначенные заявки" subtitle="Эксперт видит только переданные ему заявки" /><Paper variant="outlined" sx={{ p: 2, mb: 3, maxWidth: 320 }}><TextField select fullWidth size="small" label="Назначения" value={statusValue} onChange={(event) => { setPage(1); setStatusValue(event.target.value); }}><MenuItem value="">Все</MenuItem><MenuItem value="ACTIVE">Требуют решения</MenuItem><MenuItem value="COMPLETED">Завершённые</MenuItem></TextField></Paper>{error && <Alert severity="error" action={<Button color="inherit" onClick={load}>Повторить</Button>}>{error}</Alert>}{loading ? <LoadingState /> : !data?.results.length ? <EmptyState title="Назначений нет" description="Новые заявки появятся после назначения администратором." /> : <><Grid container spacing={2}>{data.results.map((assignment) => <Grid key={assignment.id} size={{ xs: 12, md: 6 }}><Card variant="outlined"><CardActionArea component={RouterLink} to={`/expert/assignments/${assignment.id}`}><CardContent><Stack direction="row" justifyContent="space-between" gap={2}><Typography variant="overline">{assignment.application.application_number}</Typography><StatusChip status={assignment.application.status} /></Stack><Typography variant="h6" sx={{ mt: 1 }}>{assignment.application.project_name}</Typography><Typography color="text.secondary">{assignment.application.organization_name} · {assignment.application.grant_title}</Typography><Typography sx={{ mt: 2 }}>{currency.format(Number(assignment.application.requested_amount))}</Typography>{assignment.report?.draft && <Alert severity="info" sx={{ mt: 2 }}>Черновик заключения сохранён</Alert>}</CardContent></CardActionArea></Card></Grid>)}</Grid>{data.count > 10 && <Stack alignItems="center" sx={{ mt: 3 }}><Pagination page={page} count={Math.ceil(data.count / 10)} onChange={(_, value) => setPage(value)} /></Stack>}</>}</>;
}

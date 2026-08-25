import SearchIcon from "@mui/icons-material/Search";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import { Alert, Box, Button, Card, CardActions, CardContent, Grid, InputAdornment, MenuItem, Pagination, Paper, Stack, TextField, Typography } from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";

import { getApiErrorMessage } from "../api/errors";
import { grantsApi, type GrantParams } from "../api/services";
import { EmptyState } from "../components/EmptyState";
import { LoadingState } from "../components/LoadingState";
import { PageHeader } from "../components/PageHeader";
import { StatusChip } from "../components/StatusChip";
import type { Grant, PaginatedResponse } from "../types";

const currency = new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 });
const dateFormat = new Intl.DateTimeFormat("ru-RU");

export function GrantsPage() {
  const [data, setData] = useState<PaginatedResponse<Grant> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState({ search: "", status: "", category: "", ordering: "-created_at", deadline_to: "" });
  const [filters, setFilters] = useState(draft);

  const loadGrants = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params: GrantParams = { page, page_size: 10, ...filters };
      const response = await grantsApi.list(params);
      setData(response.data);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => { void loadGrants(); }, [loadGrants]);

  return (
    <Box>
      <PageHeader title="Каталог грантов" subtitle="Актуальные меры поддержки для МСП и некоммерческих организаций" />
      <Paper component="form" variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, mb: 3, backgroundColor: "background.paper" }} onSubmit={(event) => { event.preventDefault(); setPage(1); setFilters({ ...draft }); }}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>Поиск и фильтры</Typography>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, md: 4 }}><TextField size="small" fullWidth label="Поиск" value={draft.search} onChange={(e) => setDraft({ ...draft, search: e.target.value })} slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> } }} /></Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}><TextField select size="small" fullWidth label="Статус" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}><MenuItem value="">Все</MenuItem><MenuItem value="OPEN">Приём заявок</MenuItem><MenuItem value="PUBLISHED">Опубликован</MenuItem></TextField></Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}><TextField size="small" fullWidth label="Категория" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} /></Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}><TextField size="small" fullWidth label="Дедлайн до" type="date" value={draft.deadline_to} onChange={(e) => setDraft({ ...draft, deadline_to: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} /></Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}><TextField select size="small" fullWidth label="Сортировка" value={draft.ordering} onChange={(e) => setDraft({ ...draft, ordering: e.target.value })}><MenuItem value="-created_at">Сначала новые</MenuItem><MenuItem value="end_date">По сроку</MenuItem><MenuItem value="-max_amount">По сумме</MenuItem><MenuItem value="title">По названию</MenuItem></TextField></Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}><Button fullWidth type="submit" variant="contained">Применить</Button></Grid>
        </Grid>
      </Paper>
      {error && <Alert severity="error" action={<Button color="inherit" onClick={loadGrants}>Повторить</Button>} sx={{ mb: 3 }}>{error}</Alert>}
      {loading ? <LoadingState label="Загружаем гранты…" /> : !data?.results.length ? <EmptyState title="Гранты не найдены" description="Измените параметры поиска или вернитесь позже." /> : (
        <>
          <Grid container spacing={2.5}>
            {data.results.map((grant) => (
              <Grid key={grant.id} size={{ xs: 12, md: 6 }}>
                <Card variant="outlined" sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
                  <CardContent sx={{ flex: 1 }}>
                    <Stack direction="row" justifyContent="space-between" gap={1} alignItems="flex-start"><Typography variant="overline" color="text.secondary">{grant.category}</Typography><StatusChip status={grant.status} /></Stack>
                    <Typography variant="h6" sx={{ mt: 1 }}>{grant.title}</Typography>
                    <Typography color="text.secondary" sx={{ mt: 1, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{grant.description}</Typography>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mt: 2.5 }}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1, color: "text.secondary" }}><CalendarMonthOutlinedIcon fontSize="small" /><Box><Typography variant="caption" display="block">Приём до</Typography><Typography variant="body2" color="text.primary" fontWeight={700}>{dateFormat.format(new Date(grant.end_date))}</Typography></Box></Stack>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1, p: 1.25, borderRadius: 2, color: "primary.main", backgroundColor: "primary.light" }}><PaymentsOutlinedIcon /><Box><Typography variant="caption" display="block" color="text.secondary">До</Typography><Typography color="primary.dark" fontWeight={800}>{currency.format(Number(grant.max_amount))}</Typography></Box></Stack>
                    </Stack>
                  </CardContent>
                  <CardActions sx={{ px: 3, py: 2, borderTop: 1, borderColor: "divider" }}><Button component={RouterLink} to={`/grants/${grant.id}`} variant="outlined">Подробнее</Button></CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
          {data.count > 10 && <Stack alignItems="center" sx={{ mt: 4 }}><Pagination page={page} count={Math.ceil(data.count / 10)} onChange={(_, value) => setPage(value)} color="primary" /></Stack>}
        </>
      )}
    </Box>
  );
}

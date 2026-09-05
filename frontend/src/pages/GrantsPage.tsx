import SearchIcon from "@mui/icons-material/Search";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import { Alert, Box, Button, Card, CardActions, CardContent, Grid, InputAdornment, MenuItem, Pagination, Paper, Stack, TextField, Typography } from "@mui/material";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link as RouterLink, useSearchParams } from "react-router-dom";

import { getApiErrorMessage } from "../api/errors";
import { grantsApi, type GrantParams } from "../api/services";
import { EmptyState } from "../components/EmptyState";
import { LoadingState } from "../components/LoadingState";
import { PageHeader } from "../components/PageHeader";
import { StatusChip } from "../components/StatusChip";
import { RussianDateField } from "../components/RussianDateField";
import type { Grant, PaginatedResponse } from "../types";
import { formatDate } from "../utils/date";

const currency = new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 });

const PAGE_SIZE = 10;
const DEFAULT_ORDERING = "-created_at";

function parsePage(value: string | null) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export function GrantsPage() {
  const [data, setData] = useState<PaginatedResponse<Grant> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const queryString = searchParams.toString();
  const page = parsePage(searchParams.get("page"));
  const filters = useMemo(() => ({
    search: searchParams.get("search") ?? "",
    status: searchParams.get("status") ?? "",
    category: searchParams.get("category") ?? "",
    ordering: searchParams.get("ordering") ?? DEFAULT_ORDERING,
    deadline_to: searchParams.get("deadline_to") ?? "",
  }), [queryString]);
  const [search, setSearch] = useState(filters.search);
  const [category, setCategory] = useState(filters.category);
  const requestIdRef = useRef(0);

  const updateQuery = useCallback((updates: Record<string, string>, resetPage = true) => {
    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams);
      for (const [name, value] of Object.entries(updates)) {
        if (!value || (name === "ordering" && value === DEFAULT_ORDERING)) {
          nextParams.delete(name);
        } else {
          nextParams.set(name, value);
        }
      }
      if (resetPage) nextParams.delete("page");
      return nextParams;
    });
  }, [setSearchParams]);

  const loadGrants = useCallback(async (signal?: AbortSignal) => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError("");
    try {
      const params: GrantParams = { page, page_size: PAGE_SIZE, ...filters };
      const response = await grantsApi.list(params, signal);
      if (signal?.aborted || requestId !== requestIdRef.current) return;
      setData(response.data);
    } catch (requestError) {
      if (signal?.aborted || requestId !== requestIdRef.current) return;
      setError(getApiErrorMessage(requestError));
    } finally {
      if (!signal?.aborted && requestId === requestIdRef.current) setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    const controller = new AbortController();
    void loadGrants(controller.signal);
    return () => controller.abort();
  }, [loadGrants]);

  useEffect(() => {
    setSearch((current) => current === filters.search ? current : filters.search);
    setCategory((current) => current === filters.category ? current : filters.category);
  }, [filters.category, filters.search]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (filters.search === search && filters.category === category) return;
      updateQuery({ search, category });
    }, 450);
    return () => window.clearTimeout(timer);
  }, [category, filters.category, filters.search, search, updateQuery]);

  const changeFilter = (name: "status" | "ordering" | "deadline_to", value: string) => {
    updateQuery({ [name]: value });
  };

  const resetFilters = () => {
    setSearch("");
    setCategory("");
    setSearchParams(new URLSearchParams());
  };

  return (
    <Box>
      <PageHeader title="Каталог грантов" subtitle="Актуальные меры поддержки для МСП и некоммерческих организаций" />
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, mb: 3, backgroundColor: "background.paper" }}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>Поиск и фильтры</Typography>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, md: 4 }}><TextField size="small" fullWidth label="Поиск" value={search} onChange={(e) => setSearch(e.target.value)} slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> } }} /></Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}><TextField select size="small" fullWidth label="Статус" value={filters.status} onChange={(e) => changeFilter("status", e.target.value)}><MenuItem value="">Все</MenuItem><MenuItem value="OPEN">Приём заявок</MenuItem><MenuItem value="PUBLISHED">Опубликован</MenuItem></TextField></Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}><TextField size="small" fullWidth label="Категория" value={category} onChange={(e) => setCategory(e.target.value)} /></Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}><RussianDateField size="small" label="Дедлайн до" value={filters.deadline_to} onChange={(deadlineTo) => changeFilter("deadline_to", deadlineTo)} /></Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}><TextField select size="small" fullWidth label="Сортировка" value={filters.ordering} onChange={(e) => changeFilter("ordering", e.target.value)}><MenuItem value="-created_at">Сначала новые</MenuItem><MenuItem value="end_date">По сроку</MenuItem><MenuItem value="-max_amount">По сумме</MenuItem><MenuItem value="title">По названию</MenuItem></TextField></Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}><Button fullWidth variant="outlined" onClick={resetFilters}>Сбросить</Button></Grid>
        </Grid>
      </Paper>
      {error ? <Alert severity="error" action={<Button color="inherit" onClick={() => void loadGrants()}>Повторить</Button>} sx={{ mb: 3 }}>{error}</Alert> : loading ? <LoadingState label="Загружаем гранты…" /> : !data?.results.length ? <EmptyState title="Гранты не найдены" description="Измените параметры поиска или вернитесь позже." /> : (
        <>
          <Grid container spacing={2.5}>
            {data.results.map((grant) => (
              <Grid key={grant.id} size={{ xs: 12, md: 6 }} sx={{ display: "flex" }}>
                <Card variant="outlined" sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
                  <CardContent sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
                    <Stack direction="row" justifyContent="space-between" gap={1} alignItems="flex-start"><Typography variant="overline" color="text.secondary">{grant.category}</Typography><StatusChip status={grant.status} /></Stack>
                    <Typography variant="h6" sx={{ mt: 1 }}>{grant.title}</Typography>
                    <Typography color="text.secondary" sx={{ mt: 1, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{grant.description}</Typography>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mt: "auto", pt: 2.5 }}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1, color: "text.secondary" }}><CalendarMonthOutlinedIcon fontSize="small" /><Box><Typography variant="caption" display="block">Приём до</Typography><Typography variant="body2" color="text.primary" fontWeight={700}>{formatDate(grant.end_date)}</Typography></Box></Stack>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1, p: 1.25, borderRadius: 2, color: "primary.main", backgroundColor: "primary.light" }}><PaymentsOutlinedIcon /><Box><Typography variant="caption" display="block" color="text.secondary">До</Typography><Typography color="primary.dark" fontWeight={800}>{currency.format(Number(grant.max_amount))}</Typography></Box></Stack>
                    </Stack>
                  </CardContent>
                  <CardActions sx={{ px: 3, py: 2, borderTop: 1, borderColor: "divider" }}><Button component={RouterLink} to={`/grants/${grant.id}`} variant="outlined">Подробнее</Button></CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
          {data.count > PAGE_SIZE && <Stack alignItems="center" sx={{ mt: 4 }}><Pagination page={page} count={Math.ceil(data.count / PAGE_SIZE)} onChange={(_, value) => updateQuery({ page: value === 1 ? "" : String(value) }, false)} color="primary" /></Stack>}
        </>
      )}
    </Box>
  );
}

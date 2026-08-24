import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { Alert, Box, Button, Divider, Paper, Stack, Typography } from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { Link as RouterLink, useParams } from "react-router-dom";

import { getApiErrorMessage } from "../api/errors";
import { grantsApi } from "../api/services";
import { useAuth } from "../auth/AuthContext";
import { LoadingState } from "../components/LoadingState";
import { StatusChip } from "../components/StatusChip";
import type { Grant } from "../types";

const currency = new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB" });
const dateFormat = new Intl.DateTimeFormat("ru-RU");

export function GrantDetailPage() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const [grant, setGrant] = useState<Grant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => { setLoading(true); setError(""); try { setGrant((await grantsApi.detail(id)).data); } catch (requestError) { setError(getApiErrorMessage(requestError)); } finally { setLoading(false); } }, [id]);
  useEffect(() => { void load(); }, [load]);

  if (loading) return <LoadingState />;
  if (error || !grant) return <Alert severity="error" action={<Button color="inherit" onClick={load}>Повторить</Button>}>{error || "Грант не найден."}</Alert>;
  return (
    <Box>
      <Button component={RouterLink} to="/grants" startIcon={<ArrowBackIcon />} sx={{ mb: 2 }}>К каталогу</Button>
      <Paper variant="outlined" sx={{ p: { xs: 3, md: 5 } }}>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={2}>
          <Box><Typography variant="overline" color="primary">{grant.category} · {grant.code}</Typography><Typography variant="h3" component="h1" sx={{ mt: 1, fontSize: { xs: "2rem", md: "3rem" } }}>{grant.title}</Typography></Box>
          <Box><StatusChip status={grant.status} /></Box>
        </Stack>
        <Divider sx={{ my: 3 }} />
        <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 1, sm: 5 }} sx={{ mb: 3 }}><Typography><b>Приём:</b> {dateFormat.format(new Date(grant.start_date))} — {dateFormat.format(new Date(grant.end_date))}</Typography><Typography><b>Максимальная сумма:</b> {currency.format(Number(grant.max_amount))}</Typography></Stack>
        <Typography sx={{ whiteSpace: "pre-wrap", lineHeight: 1.75 }}>{grant.description}</Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mt: 4 }}>
          {grant.status === "OPEN" && user?.role === "Applicant" && <Button component={RouterLink} to={`/applications/new?grant=${grant.id}`} variant="contained" size="large">Создать заявку</Button>}
          {grant.status === "OPEN" && !user && <Button component={RouterLink} to="/login" state={{ from: `/grants/${grant.id}` }} variant="contained" size="large">Войти и подать заявку</Button>}
        </Stack>
      </Paper>
    </Box>
  );
}

import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PendingActionsIcon from "@mui/icons-material/PendingActions";
import RateReviewIcon from "@mui/icons-material/RateReview";
import { Alert, Button, Card, CardContent, Grid, Stack, Typography } from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";

import { getApiErrorMessage } from "../../api/errors";
import { expertApi } from "../../api/services";
import { LoadingState } from "../../components/LoadingState";
import { PageHeader } from "../../components/PageHeader";
import type { ExpertDashboard } from "../../types";

export function ExpertDashboardPage() {
  const [data, setData] = useState<ExpertDashboard | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => { setError(""); try { setData((await expertApi.dashboard()).data); } catch (requestError) { setError(getApiErrorMessage(requestError)); } }, []);
  useEffect(() => { void load(); }, [load]);
  if (!data && !error) return <LoadingState />;
  return <><PageHeader title="Кабинет эксперта" subtitle="Назначенные заявки и экспертные заключения" action={<Button component={RouterLink} to="/expert/assignments" variant="contained">Перейти к заявкам</Button>} />{error && <Alert severity="error" action={<Button color="inherit" onClick={load}>Повторить</Button>}>{error}</Alert>}{data && <Grid container spacing={2.5}>{[["Активные", data.active, <PendingActionsIcon />], ["Завершённые", data.completed, <CheckCircleIcon />], ["Всего назначений", data.total, <RateReviewIcon />]].map(([label, value, icon]) => <Grid key={String(label)} size={{ xs: 12, sm: 4 }} sx={{ display: "flex" }}><Card variant="outlined" sx={{ width: "100%", height: "100%" }}><CardContent><Stack direction="row" justifyContent="space-between" color="primary.main">{icon}<Typography variant="h4">{String(value)}</Typography></Stack><Typography fontWeight={700} sx={{ mt: 2 }}>{String(label)}</Typography></CardContent></Card></Grid>)}</Grid>}</>;
}

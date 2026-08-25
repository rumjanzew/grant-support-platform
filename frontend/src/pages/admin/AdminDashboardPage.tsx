import AssignmentIcon from "@mui/icons-material/Assignment";
import GroupsIcon from "@mui/icons-material/Groups";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import RateReviewIcon from "@mui/icons-material/RateReview";
import { Alert, Box, Button, Card, CardContent, Grid, Paper, Stack, Typography } from "@mui/material";
import { ArcElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, LineElement, PointElement, Tooltip } from "chart.js";
import { useCallback, useEffect, useState } from "react";
import { Doughnut, Line } from "react-chartjs-2";
import { Link as RouterLink } from "react-router-dom";

import { administratorApi } from "../../api/services";
import { getApiErrorMessage } from "../../api/errors";
import { LoadingState } from "../../components/LoadingState";
import { PageHeader } from "../../components/PageHeader";
import type { AdministratorDashboard } from "../../types";
import { formatDate } from "../../utils/date";
import { getStatusLabel } from "../../utils/labels";

ChartJS.register(ArcElement, CategoryScale, Legend, LinearScale, LineElement, PointElement, Tooltip);

export function AdminDashboardPage() {
  const [data, setData] = useState<AdministratorDashboard | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setError("");
    try { setData((await administratorApi.dashboard()).data); }
    catch (requestError) { setError(getApiErrorMessage(requestError)); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (!data && !error) return <LoadingState />;
  const statuses = data?.applications_by_status ?? [];
  const registrations = data?.user_registrations_by_day ?? [];
  const applications = data?.applications_by_day ?? [];
  return (
    <>
      <PageHeader title="Панель администратора" subtitle="Управление грантами, заявками и пользователями" />
      {error && <Alert severity="error" action={<Button color="inherit" onClick={load}>Повторить</Button>}>{error}</Alert>}
      {data && <Stack spacing={3}>
        <Grid container spacing={2.5}>
          {[
            ["Гранты", data.grants, <LocalOfferIcon />, "/admin/grants"],
            ["Заявки", data.applications, <AssignmentIcon />, "/admin/applications"],
            ["Ожидают назначения", data.awaiting_assignment, <RateReviewIcon />, "/admin/applications?status=SUBMITTED"],
            ["На экспертизе", data.under_review, <RateReviewIcon />, "/admin/applications?status=UNDER_REVIEW"],
            ["Пользователи", data.users, <GroupsIcon />, "/admin/users"],
            ["Эксперты", data.experts, <GroupsIcon />, "/admin/users"],
          ].map(([label, value, icon, to]) => <Grid key={String(label)} size={{ xs: 12, sm: 6, lg: 4 }}><Card variant="outlined" sx={{ height: "100%" }}><CardContent><Stack direction="row" justifyContent="space-between" alignItems="center"><Box sx={{ width: 44, height: 44, display: "grid", placeItems: "center", borderRadius: 2.5, color: "primary.main", backgroundColor: "primary.light" }}>{icon}</Box><Typography variant="h4" color="primary.dark">{String(value)}</Typography></Stack><Typography sx={{ mt: 2 }} fontWeight={700}>{String(label)}</Typography><Button component={RouterLink} to={String(to)} sx={{ mt: 1, px: 0 }}>Открыть</Button></CardContent></Card></Grid>)}
        </Grid>
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, lg: 5 }}>
            <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, height: "100%", boxShadow: "0 3px 14px rgba(32, 32, 51, 0.05)" }}>
              <Typography variant="h6" gutterBottom>Заявки по статусам</Typography>
              <Box sx={{ height: { xs: 280, sm: 340 }, position: "relative" }}>
                <Doughnut
                  data={{ labels: statuses.map((item) => getStatusLabel(item.status)), datasets: [{ data: statuses.map((item) => item.count), backgroundColor: ["#A5B4FC", "#60A5FA", "#F59E0B", "#34D399", "#F87171", "#FBBF24", "#818CF8"] }] }}
                  options={{ maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } }}
                />
              </Box>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, lg: 7 }}>
            <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, height: "100%", boxShadow: "0 3px 14px rgba(32, 32, 51, 0.05)" }}>
              <Typography variant="h6" gutterBottom>Активность за 14 дней</Typography>
              <Box sx={{ height: { xs: 280, sm: 340 }, position: "relative" }}>
                <Line
                  data={{ labels: registrations.map((item) => formatDate(item.date)), datasets: [{ label: "Регистрации", data: registrations.map((item) => item.count), borderColor: "#6366F1", backgroundColor: "#6366F1", tension: 0.25 }, { label: "Заявки", data: applications.map((item) => item.count), borderColor: "#4F46E5", backgroundColor: "#4F46E5", tension: 0.25 }] }}
                  options={{ maintainAspectRatio: false, responsive: true, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }}
                />
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </Stack>}
    </>
  );
}

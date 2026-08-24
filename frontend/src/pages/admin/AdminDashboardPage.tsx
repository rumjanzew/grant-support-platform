import AssignmentIcon from "@mui/icons-material/Assignment";
import GroupsIcon from "@mui/icons-material/Groups";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import RateReviewIcon from "@mui/icons-material/RateReview";
import { Alert, Button, Card, CardContent, Grid, Stack, Typography } from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";

import { administratorApi } from "../../api/services";
import { getApiErrorMessage } from "../../api/errors";
import { LoadingState } from "../../components/LoadingState";
import { PageHeader } from "../../components/PageHeader";
import type { AdministratorDashboard } from "../../types";

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
  return (
    <>
      <PageHeader title="Панель администратора" subtitle="Управление грантами, заявками и пользователями" />
      {error && <Alert severity="error" action={<Button color="inherit" onClick={load}>Повторить</Button>}>{error}</Alert>}
      {data && <Grid container spacing={2.5}>
        {[
          ["Гранты", data.grants, <LocalOfferIcon />, "/admin/grants"],
          ["Заявки", data.applications, <AssignmentIcon />, "/admin/applications"],
          ["Ожидают назначения", data.awaiting_assignment, <RateReviewIcon />, "/admin/applications?status=SUBMITTED"],
          ["Пользователи", data.users, <GroupsIcon />, "/admin/users"],
        ].map(([label, value, icon, to]) => <Grid key={String(label)} size={{ xs: 12, sm: 6, lg: 3 }}><Card variant="outlined" sx={{ height: "100%" }}><CardContent><Stack direction="row" justifyContent="space-between" color="primary.main">{icon}<Typography variant="h4">{String(value)}</Typography></Stack><Typography sx={{ mt: 2 }} fontWeight={700}>{String(label)}</Typography><Button component={RouterLink} to={String(to)} sx={{ mt: 1, px: 0 }}>Открыть</Button></CardContent></Card></Grid>)}
      </Grid>}
    </>
  );
}

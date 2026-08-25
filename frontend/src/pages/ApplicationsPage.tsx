import AddIcon from "@mui/icons-material/Add";
import { Alert, Button, Card, CardActionArea, CardContent, Grid, Stack, Typography } from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";

import { getApiErrorMessage } from "../api/errors";
import { applicationsApi } from "../api/services";
import { EmptyState } from "../components/EmptyState";
import { LoadingState } from "../components/LoadingState";
import { PageHeader } from "../components/PageHeader";
import { StatusChip } from "../components/StatusChip";
import type { Application } from "../types";

const currency = new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB" });
const dateFormat = new Intl.DateTimeFormat("ru-RU");

export function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => { setLoading(true); setError(""); try { setApplications((await applicationsApi.list()).data); } catch (requestError) { setError(getApiErrorMessage(requestError)); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);

  return (
    <>
      <PageHeader title="Мои заявки" subtitle="Черновики и отправленные заявки вашей организации" action={<Button component={RouterLink} to="/applications/new" startIcon={<AddIcon />} variant="contained">Новая заявка</Button>} />
      {error && <Alert severity="error" action={<Button color="inherit" onClick={load}>Повторить</Button>}>{error}</Alert>}
      {loading ? <LoadingState /> : !applications.length ? <EmptyState title="Заявок пока нет" description="Выберите открытый грант и создайте первую заявку." actionLabel="Создать заявку" actionTo="/applications/new" /> : (
        <Grid container spacing={2}>
          {applications.map((application) => (
            <Grid key={application.id} size={{ xs: 12, md: 6 }}>
              <Card variant="outlined" sx={{ height: "100%" }}>
                <CardActionArea component={RouterLink} to={`/applications/${application.id}`} sx={{ height: "100%" }}>
                  <CardContent>
                    <Stack direction="row" justifyContent="space-between" gap={1}><Typography variant="overline" color="text.secondary">{application.application_number ?? "Номер после отправки"}</Typography><StatusChip status={application.status} /></Stack>
                    <Typography variant="h6" sx={{ mt: 1 }}>{application.project_name}</Typography>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 0.5, sm: 3 }} sx={{ mt: 2.5, pt: 2, borderTop: 1, borderColor: "divider" }}><Typography variant="body2" fontWeight={700}>Сумма: {currency.format(Number(application.requested_amount))}</Typography><Typography variant="body2" color="text.secondary">Изменена: {dateFormat.format(new Date(application.updated_at))}</Typography></Stack>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </>
  );
}

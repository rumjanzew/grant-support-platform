import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AttachFileOutlinedIcon from "@mui/icons-material/AttachFileOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import { Alert, Box, Button, Divider, List, ListItem, ListItemText, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link as RouterLink, useParams } from "react-router-dom";

import { getApiErrorMessage } from "../../api/errors";
import { expertApi } from "../../api/services";
import { LoadingState } from "../../components/LoadingState";
import { StatusChip } from "../../components/StatusChip";
import { useNotify } from "../../notifications/NotificationContext";
import type { ExpertAssignment, ExpertDecision } from "../../types";

interface ReportForm { score: number; comment: string; decision: ExpertDecision; }
const currency = new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB" });

function SectionTitle({ icon, title, description }: { icon: React.ReactNode; title: string; description?: string }) {
  return (
    <Stack direction="row" spacing={1.5} alignItems="center">
      <Box sx={{ width: 42, height: 42, flexShrink: 0, display: "grid", placeItems: "center", borderRadius: 2.5, color: "primary.main", backgroundColor: "primary.light" }}>{icon}</Box>
      <Box><Typography variant="h5">{title}</Typography>{description && <Typography variant="body2" color="text.secondary">{description}</Typography>}</Box>
    </Stack>
  );
}

export function ExpertAssignmentDetailPage() {
  const { id = "" } = useParams();
  const notify = useNotify();
  const [assignment, setAssignment] = useState<ExpertAssignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { register, handleSubmit, reset, getValues, formState: { errors, isSubmitting } } = useForm<ReportForm>({ defaultValues: { comment: "", decision: "APPROVED" } });
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await expertApi.assignment(id);
      setAssignment(response.data);
      reset({ score: response.data.report?.score ?? Number.NaN, comment: response.data.report?.comment ?? "", decision: (response.data.report?.decision || "APPROVED") as ExpertDecision });
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [id, reset]);
  useEffect(() => { void load(); }, [load]);

  const saveDraft = async (data: ReportForm) => {
    try {
      await expertApi.saveReport(id, { score: Number.isNaN(data.score) ? null : data.score, comment: data.comment });
      notify("Черновик заключения сохранён.");
      await load();
    } catch (requestError) { notify(getApiErrorMessage(requestError), "error"); }
  };
  const submitDecision = async () => {
    const data = getValues();
    if (!Number.isFinite(data.score) || data.score < 0 || data.score > 100) { notify("Укажите оценку от 0 до 100.", "error"); return; }
    if (!data.comment.trim()) { notify("Добавьте комментарий к решению.", "error"); return; }
    try {
      await expertApi.decide(id, { score: data.score, comment: data.comment, decision: data.decision });
      notify("Экспертное решение принято.");
      await load();
    } catch (requestError) { notify(getApiErrorMessage(requestError), "error"); }
  };

  if (loading) return <LoadingState />;
  if (error || !assignment) return <Alert severity="error" action={<Button color="inherit" onClick={load}>Повторить</Button>}>{error || "Назначение не найдено."}</Alert>;
  const application = assignment.application;
  const active = assignment.status === "ACTIVE";

  return (
    <Box>
      <Button component={RouterLink} to="/expert/assignments" startIcon={<ArrowBackIcon />} sx={{ mb: 2 }}>К назначениям</Button>
      <Stack spacing={3}>
        <Paper variant="outlined" sx={{ p: { xs: 2.5, sm: 3, md: 4 } }}>
          <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={2}>
            <Box><Typography variant="overline" color="text.secondary">{application.application_number} · версия {application.version}</Typography><Typography variant="h4" component="h1" sx={{ mt: 0.5 }}>{application.project_name}</Typography><Typography color="text.secondary" sx={{ mt: 1 }}>{application.organization_name}, ИНН {application.organization_inn}</Typography></Box>
            <Box><StatusChip status={application.status} /></Box>
          </Stack>
          <Alert severity="info" sx={{ mt: 3 }}>{application.grant_title} ({application.grant_code}) · <b>{currency.format(Number(application.requested_amount))}</b></Alert>
          <Divider sx={{ my: 3 }} />
          <SectionTitle icon={<DescriptionOutlinedIcon />} title="Описание заявки" />
          <Typography sx={{ mt: 2, whiteSpace: "pre-wrap", lineHeight: 1.75 }}>{application.description}</Typography>
        </Paper>

        <Paper variant="outlined" sx={{ p: { xs: 2.5, sm: 3, md: 4 }, backgroundColor: "background.paper" }}>
          <SectionTitle icon={<AttachFileOutlinedIcon />} title="Документы" description={`${application.attachments.length} файл(а) в заявке`} />
          <Divider sx={{ my: 2.5 }} />
          {!application.attachments.length ? <Typography color="text.secondary">Документы не приложены.</Typography> : <List disablePadding sx={{ border: 1, borderColor: "divider", borderRadius: 2, overflow: "hidden", backgroundColor: "background.paper" }}>{application.attachments.map((file) => <ListItem key={file.id} divider><ListItemText primary={file.original_name} secondary={`${(file.size_bytes / 1024).toFixed(1)} КБ · ${file.mime_type}`} /></ListItem>)}</List>}
        </Paper>

        <Paper variant="outlined" sx={{ p: { xs: 2.5, sm: 3, md: 4 } }}>
          <SectionTitle icon={<FactCheckOutlinedIcon />} title="Экспертное заключение" description={active ? "Сохраните черновик или примите итоговое решение" : "Экспертиза завершена"} />
          {!active && assignment.report && <Alert severity="success" sx={{ mt: 2.5 }}>Решение принято: <StatusChip status={assignment.report.decision} /></Alert>}
          <Box component="form" onSubmit={handleSubmit(saveDraft)} sx={{ mt: 3 }}>
            <Stack spacing={2.5}>
              <TextField required label="Оценка, 0–100" type="number" disabled={!active} error={Boolean(errors.score)} helperText={errors.score?.message} {...register("score", { valueAsNumber: true, min: { value: 0, message: "Минимум 0" }, max: { value: 100, message: "Максимум 100" } })} />
              <TextField required label="Комментарий" multiline minRows={6} disabled={!active} {...register("comment")} />
              {active && <><TextField required select label="Решение" defaultValue="APPROVED" {...register("decision")}><MenuItem value="APPROVED">Одобрить</MenuItem><MenuItem value="REJECTED">Отклонить</MenuItem><MenuItem value="REVISION_REQUIRED">Вернуть на доработку</MenuItem></TextField><Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="flex-end"><Button type="submit" variant="outlined" disabled={isSubmitting}>Сохранить черновик</Button><Button variant="contained" color="success" size="large" disabled={isSubmitting} onClick={() => void submitDecision()}>Принять итоговое решение</Button></Stack></>}
            </Stack>
          </Box>
        </Paper>
      </Stack>
    </Box>
  );
}

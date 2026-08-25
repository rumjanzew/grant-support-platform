import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, IconButton, List, ListItem, ListItemText, Paper, Stack, TextField, Typography } from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link as RouterLink, useParams } from "react-router-dom";

import { getApiErrorMessage } from "../api/errors";
import { applicationsApi, grantsApi, type ApplicationInput } from "../api/services";
import { LoadingState } from "../components/LoadingState";
import { StatusChip } from "../components/StatusChip";
import { useNotify } from "../notifications/NotificationContext";
import type { Application, Attachment, Grant } from "../types";
import { formatDateTime } from "../utils/date";

const currency = new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB" });
const editableStatuses = new Set(["DRAFT", "REVISION_REQUIRED"]);

export function ApplicationDetailPage() {
  const { id = "" } = useParams();
  const notify = useNotify();
  const [application, setApplication] = useState<Application | null>(null);
  const [grant, setGrant] = useState<Grant | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ApplicationInput>();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const applicationResponse = await applicationsApi.detail(id);
      const [grantResponse, attachmentsResponse] = await Promise.all([
        grantsApi.detail(applicationResponse.data.grant),
        applicationsApi.attachments(id),
      ]);
      setApplication(applicationResponse.data);
      setGrant(grantResponse.data);
      setAttachments(attachmentsResponse.data);
      reset({
        grant: applicationResponse.data.grant,
        project_name: applicationResponse.data.project_name,
        description: applicationResponse.data.description,
        requested_amount: applicationResponse.data.requested_amount,
      });
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [id, reset]);

  useEffect(() => { void load(); }, [load]);

  const saveDraft = async (data: ApplicationInput) => {
    if (!application) return;
    setError("");
    try {
      const response = await applicationsApi.update(application.id, {
        project_name: data.project_name,
        description: data.description,
        requested_amount: data.requested_amount,
      });
      setApplication(response.data);
      notify("Изменения сохранены.");
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    }
  };

  const uploadFile = async (file?: File) => {
    if (!file || !application) return;
    if (file.size > 10 * 1024 * 1024) { notify("Файл превышает допустимый размер 10 МБ.", "error"); return; }
    setBusy(true);
    try {
      const response = await applicationsApi.upload(application.id, file);
      setAttachments((current) => [...current, response.data]);
      notify("Файл загружен.");
    } catch (requestError) {
      notify(getApiErrorMessage(requestError), "error");
    } finally {
      setBusy(false);
    }
  };

  const removeFile = async (attachment: Attachment) => {
    if (!application) return;
    setBusy(true);
    try {
      await applicationsApi.deleteAttachment(application.id, attachment.id);
      setAttachments((current) => current.filter((item) => item.id !== attachment.id));
      notify("Файл удалён.");
    } catch (requestError) {
      notify(getApiErrorMessage(requestError), "error");
    } finally {
      setBusy(false);
    }
  };

  const submitApplication = async () => {
    if (!application) return;
    setBusy(true);
    setConfirmOpen(false);
    try {
      const response = await applicationsApi.submit(application.id);
      setApplication(response.data);
      notify("Заявка успешно отправлена.");
    } catch (requestError) {
      notify(getApiErrorMessage(requestError), "error");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState label="Загружаем заявку…" />;
  if (error && !application) return <Alert severity="error" action={<Button color="inherit" onClick={load}>Повторить</Button>}>{error}</Alert>;
  if (!application) return <Alert severity="error">Заявка не найдена.</Alert>;
  const editable = editableStatuses.has(application.status);

  return (
    <Box>
      <Button component={RouterLink} to="/applications" startIcon={<ArrowBackIcon />} sx={{ mb: 2 }}>К заявкам</Button>
      <Stack spacing={3}>
        <Paper variant="outlined" sx={{ p: { xs: 2.5, sm: 3, md: 4 } }}>
          <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={2}>
            <Box><Typography variant="overline" color="text.secondary">{application.application_number ?? "Черновик без номера"}</Typography><Typography variant="h4" component="h1">{application.project_name}</Typography><Typography color="text.secondary" sx={{ mt: 1 }}>Версия {application.version} · изменена {formatDateTime(application.updated_at)}</Typography></Box>
            <Box><StatusChip status={application.status} /></Box>
          </Stack>
          {grant && <Alert severity="info" sx={{ mt: 3 }}>Грант: <b>{grant.title}</b> · запрошено {currency.format(Number(application.requested_amount))}</Alert>}
        </Paper>

        {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}
        <Paper variant="outlined" sx={{ p: { xs: 2.5, sm: 3, md: 4 } }}>
          <Typography variant="h5" sx={{ mb: 3 }}>Данные проекта</Typography>
          <Box component="form" onSubmit={handleSubmit(saveDraft)}>
            <Stack spacing={2.5}>
              <TextField required label="Название проекта" fullWidth disabled={!editable} error={Boolean(errors.project_name)} helperText={errors.project_name?.message} {...register("project_name", { required: "Введите название" })} />
              <TextField required label="Описание проекта" fullWidth multiline minRows={6} disabled={!editable} error={Boolean(errors.description)} helperText={errors.description?.message} {...register("description", { required: "Добавьте описание" })} />
              <TextField required label="Запрашиваемая сумма, ₽" type="number" fullWidth disabled={!editable} error={Boolean(errors.requested_amount)} helperText={errors.requested_amount?.message} {...register("requested_amount", { required: "Укажите сумму", min: { value: 1, message: "Сумма должна быть больше нуля" } })} />
              {editable && <Button type="submit" variant="outlined" disabled={isSubmitting}>{isSubmitting ? "Сохраняем…" : "Сохранить изменения"}</Button>}
            </Stack>
          </Box>
        </Paper>

        <Paper variant="outlined" sx={{ p: { xs: 2.5, sm: 3, md: 4 }, backgroundColor: "background.paper" }}>
          <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} gap={2}>
            <Box><Typography variant="h5">Документы</Typography><Typography variant="body2" color="text.secondary">До 5 файлов, не более 10 МБ каждый</Typography></Box>
            {editable && <Button component="label" startIcon={<UploadFileIcon />} variant="outlined" disabled={busy || attachments.length >= 5}>Загрузить<input hidden type="file" onChange={(event) => { void uploadFile(event.target.files?.[0]); event.target.value = ""; }} /></Button>}
          </Stack>
          <Divider sx={{ my: 2 }} />
          {!attachments.length ? <Typography color="text.secondary">Документы пока не загружены.</Typography> : (
            <List disablePadding sx={{ border: 1, borderColor: "divider", borderRadius: 2, overflow: "hidden", backgroundColor: "background.paper" }}>
              {attachments.map((attachment) => <ListItem key={attachment.id} divider secondaryAction={editable ? <IconButton disabled={busy} edge="end" aria-label={`Удалить ${attachment.original_name}`} onClick={() => void removeFile(attachment)}><DeleteOutlineIcon /></IconButton> : undefined}><ListItemText primary={attachment.original_name} secondary={`${(attachment.size_bytes / 1024).toFixed(1)} КБ · ${formatDateTime(attachment.uploaded_at)}`} /></ListItem>)}
            </List>
          )}
        </Paper>

        {editable && <Paper variant="outlined" sx={{ p: 3, display: "flex", flexDirection: { xs: "column", sm: "row" }, alignItems: { xs: "stretch", sm: "center" }, justifyContent: "space-between", gap: 2 }}><Box><Typography variant="h6">Готовы отправить?</Typography><Typography color="text.secondary">После отправки редактирование и изменение файлов будут недоступны.</Typography></Box><Button variant="contained" size="large" disabled={busy} onClick={() => setConfirmOpen(true)}>{application.status === "REVISION_REQUIRED" ? "Отправить доработку" : "Отправить заявку"}</Button></Paper>}
      </Stack>
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}><DialogTitle>Подтвердите отправку</DialogTitle><DialogContent><Typography>Проверьте данные и документы. После отправки изменить заявку будет нельзя.</Typography></DialogContent><DialogActions><Button onClick={() => setConfirmOpen(false)}>Отмена</Button><Button variant="contained" onClick={() => void submitApplication()}>Отправить</Button></DialogActions></Dialog>
    </Box>
  );
}

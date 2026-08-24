import ArrowBackIcon from "@mui/icons-material/ArrowBack";
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

export function ExpertAssignmentDetailPage() {
  const { id = "" } = useParams();
  const notify = useNotify();
  const [assignment, setAssignment] = useState<ExpertAssignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { register, handleSubmit, reset, getValues, formState: { errors, isSubmitting } } = useForm<ReportForm>({ defaultValues: { comment: "", decision: "APPROVED" } });
  const load = useCallback(async () => { setLoading(true); setError(""); try { const response = await expertApi.assignment(id); setAssignment(response.data); reset({ score: response.data.report?.score ?? Number.NaN, comment: response.data.report?.comment ?? "", decision: (response.data.report?.decision || "APPROVED") as ExpertDecision }); } catch (requestError) { setError(getApiErrorMessage(requestError)); } finally { setLoading(false); } }, [id, reset]);
  useEffect(() => { void load(); }, [load]);
  const saveDraft = async (data: ReportForm) => { try { await expertApi.saveReport(id, { score: Number.isNaN(data.score) ? null : data.score, comment: data.comment }); notify("Черновик заключения сохранён."); await load(); } catch (requestError) { notify(getApiErrorMessage(requestError), "error"); } };
  const submitDecision = async () => { const data = getValues(); if (!Number.isFinite(data.score) || data.score < 0 || data.score > 100) { notify("Укажите оценку от 0 до 100.", "error"); return; } if (!data.comment.trim()) { notify("Добавьте комментарий к решению.", "error"); return; } try { await expertApi.decide(id, { score: data.score, comment: data.comment, decision: data.decision }); notify("Экспертное решение принято."); await load(); } catch (requestError) { notify(getApiErrorMessage(requestError), "error"); } };
  if (loading) return <LoadingState />;
  if (error || !assignment) return <Alert severity="error" action={<Button color="inherit" onClick={load}>Повторить</Button>}>{error || "Назначение не найдено."}</Alert>;
  const application = assignment.application;
  const active = assignment.status === "ACTIVE";
  return <Box><Button component={RouterLink} to="/expert/assignments" startIcon={<ArrowBackIcon />} sx={{ mb: 2 }}>К назначениям</Button><Stack spacing={3}><Paper variant="outlined" sx={{ p: { xs: 3, md: 4 } }}><Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={2}><Box><Typography variant="overline">{application.application_number} · версия {application.version}</Typography><Typography variant="h4" component="h1">{application.project_name}</Typography><Typography color="text.secondary" sx={{ mt: 1 }}>{application.organization_name}, ИНН {application.organization_inn}</Typography></Box><StatusChip status={application.status} /></Stack><Alert severity="info" sx={{ mt: 3 }}>{application.grant_title} ({application.grant_code}) · {currency.format(Number(application.requested_amount))}</Alert><Typography sx={{ mt: 3, whiteSpace: "pre-wrap" }}>{application.description}</Typography></Paper><Paper variant="outlined" sx={{ p: { xs: 3, md: 4 } }}><Typography variant="h5">Документы</Typography><Divider sx={{ my: 2 }} />{!application.attachments.length ? <Typography color="text.secondary">Документы не приложены.</Typography> : <List disablePadding>{application.attachments.map((file) => <ListItem key={file.id} divider><ListItemText primary={file.original_name} secondary={`${(file.size_bytes / 1024).toFixed(1)} КБ · ${file.mime_type}`} /></ListItem>)}</List>}</Paper><Paper variant="outlined" sx={{ p: { xs: 3, md: 4 } }}><Typography variant="h5">Экспертное заключение</Typography>{!active && assignment.report && <Alert severity="success" sx={{ mt: 2 }}>Решение принято: <StatusChip status={assignment.report.decision} /></Alert>}<Box component="form" onSubmit={handleSubmit(saveDraft)} sx={{ mt: 3 }}><Stack spacing={2.5}><TextField label="Оценка, 0–100" type="number" disabled={!active} error={Boolean(errors.score)} helperText={errors.score?.message} {...register("score", { valueAsNumber: true, min: { value: 0, message: "Минимум 0" }, max: { value: 100, message: "Максимум 100" } })} /><TextField label="Комментарий" multiline minRows={6} disabled={!active} {...register("comment")} />{active && <><TextField select label="Решение" defaultValue="APPROVED" {...register("decision")}><MenuItem value="APPROVED">Одобрить</MenuItem><MenuItem value="REJECTED">Отклонить</MenuItem><MenuItem value="REVISION_REQUIRED">Вернуть на доработку</MenuItem></TextField><Stack direction={{ xs: "column", sm: "row" }} spacing={2}><Button type="submit" variant="outlined" disabled={isSubmitting}>Сохранить черновик</Button><Button variant="contained" color="success" disabled={isSubmitting} onClick={() => void submitDecision()}>Принять решение</Button></Stack></>}</Stack></Box></Paper></Stack></Box>;
}

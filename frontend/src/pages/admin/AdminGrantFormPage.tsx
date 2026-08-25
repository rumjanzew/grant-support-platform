import { Alert, Box, Button, Grid, MenuItem, Paper, Stack, TextField } from "@mui/material";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";

import { getApiErrorMessage } from "../../api/errors";
import { grantsApi } from "../../api/services";
import { LoadingState } from "../../components/LoadingState";
import { PageHeader } from "../../components/PageHeader";
import { RussianDateField } from "../../components/RussianDateField";
import { useNotify } from "../../notifications/NotificationContext";
import type { GrantStatus } from "../../types";
import { getStatusLabel } from "../../utils/labels";

interface GrantFormData {
  code: string;
  title: string;
  description: string;
  category: string;
  start_date: string;
  end_date: string;
  max_amount: string;
  status: GrantStatus;
}

const grantStatuses: GrantStatus[] = ["DRAFT", "PUBLISHED", "OPEN", "CLOSED", "ARCHIVED"];

export function AdminGrantFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const notify = useNotify();
  const [loading, setLoading] = useState(editing);
  const [error, setError] = useState("");
  const { register, control, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<GrantFormData>({ defaultValues: { status: "DRAFT", start_date: "", end_date: "" } });

  useEffect(() => {
    if (!id) return;
    grantsApi.detail(id)
      .then((response) => reset(response.data))
      .catch((requestError) => setError(getApiErrorMessage(requestError)))
      .finally(() => setLoading(false));
  }, [id, reset]);

  const onSubmit = async (data: GrantFormData) => {
    setError("");
    try {
      if (id) await grantsApi.update(id, data);
      else await grantsApi.create(data);
      notify(editing ? "Грант обновлён." : "Грант создан.");
      navigate("/admin/grants");
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    }
  };

  if (loading) return <LoadingState />;
  return (
    <>
      <PageHeader title={editing ? "Редактирование гранта" : "Новый грант"} subtitle="Статус и сроки определяют доступность программы заявителям" />
      <Paper variant="outlined" sx={{ p: { xs: 3, md: 4 } }}>
        <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <Stack spacing={2.5}>
            {error && <Alert severity="error">{error}</Alert>}
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 4 }}><TextField required fullWidth label="Код" error={Boolean(errors.code)} helperText={errors.code?.message} {...register("code", { required: "Укажите код" })} /></Grid>
              <Grid size={{ xs: 12, sm: 8 }}><TextField required fullWidth label="Название" error={Boolean(errors.title)} helperText={errors.title?.message} {...register("title", { required: "Укажите название" })} /></Grid>
            </Grid>
            <TextField required fullWidth label="Категория" error={Boolean(errors.category)} helperText={errors.category?.message} {...register("category", { required: "Укажите категорию" })} />
            <TextField required fullWidth multiline minRows={6} label="Описание" error={Boolean(errors.description)} helperText={errors.description?.message} {...register("description", { required: "Добавьте описание" })} />
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 4 }}><Controller name="start_date" control={control} rules={{ required: "Укажите дату начала" }} render={({ field, fieldState }) => <RussianDateField required label="Начало" value={field.value} onChange={field.onChange} error={Boolean(fieldState.error)} helperText={fieldState.error?.message} />} /></Grid>
              <Grid size={{ xs: 12, sm: 4 }}><Controller name="end_date" control={control} rules={{ required: "Укажите дату окончания" }} render={({ field, fieldState }) => <RussianDateField required label="Окончание" value={field.value} onChange={field.onChange} error={Boolean(fieldState.error)} helperText={fieldState.error?.message} />} /></Grid>
              <Grid size={{ xs: 12, sm: 4 }}><TextField required fullWidth type="number" label="Максимальная сумма, ₽" error={Boolean(errors.max_amount)} helperText={errors.max_amount?.message} {...register("max_amount", { required: "Укажите максимальную сумму", min: { value: 1, message: "Сумма должна быть больше нуля" } })} /></Grid>
            </Grid>
            <TextField select fullWidth label="Статус" defaultValue="DRAFT" {...register("status")}>{grantStatuses.map((status) => <MenuItem key={status} value={status}>{getStatusLabel(status)}</MenuItem>)}</TextField>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <Button type="submit" variant="contained" disabled={isSubmitting}>{isSubmitting ? "Сохраняем…" : "Сохранить"}</Button>
              <Button onClick={() => navigate("/admin/grants")}>Отмена</Button>
            </Stack>
          </Stack>
        </Box>
      </Paper>
    </>
  );
}

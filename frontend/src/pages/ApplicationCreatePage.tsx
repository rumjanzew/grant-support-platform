import { Alert, Box, Button, MenuItem, Paper, Stack, TextField } from "@mui/material";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router-dom";

import { getApiErrorMessage } from "../api/errors";
import { applicationsApi, grantsApi, type ApplicationInput } from "../api/services";
import { useAuth } from "../auth/AuthContext";
import { LoadingState } from "../components/LoadingState";
import { OrganizationSetupForm } from "../components/OrganizationSetupForm";
import { PageHeader } from "../components/PageHeader";
import { useNotify } from "../notifications/NotificationContext";
import type { Grant } from "../types";

export function ApplicationCreatePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const notify = useNotify();
  const [searchParams] = useSearchParams();
  const [grants, setGrants] = useState<Grant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<ApplicationInput>();

  useEffect(() => {
    if (!user?.organization) { setLoading(false); return; }
    grantsApi.list({ status: "OPEN", page_size: 20 }).then((response) => {
      setGrants(response.data.results);
      const selected = searchParams.get("grant");
      if (selected && response.data.results.some((grant) => grant.id === selected)) setValue("grant", selected);
    }).catch((requestError) => setError(getApiErrorMessage(requestError))).finally(() => setLoading(false));
  }, [searchParams, setValue, user?.organization]);

  const onSubmit = async (data: ApplicationInput) => {
    setError("");
    try {
      const response = await applicationsApi.create(data);
      notify("Черновик заявки создан.");
      navigate(`/applications/${response.data.id}`);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    }
  };

  return (
    <>
      <PageHeader title="Новая заявка" subtitle="Создайте черновик — его можно редактировать до отправки" />
      {!user?.organization ? <OrganizationSetupForm /> : loading ? <LoadingState /> : (
        <Paper variant="outlined" sx={{ p: { xs: 2.5, sm: 3.5, md: 4 }, maxWidth: 840, mx: "auto" }}>
          <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
            <Stack spacing={2.5}>
              {error && <Alert severity="error">{error}</Alert>}
              {!grants.length && <Alert severity="info">Сейчас нет открытых грантов для подачи заявки.</Alert>}
              <TextField required select label="Грант" fullWidth disabled={!grants.length} defaultValue="" error={Boolean(errors.grant)} helperText={errors.grant?.message} {...register("grant", { required: "Выберите грант" })}>
                {grants.map((grant) => <MenuItem key={grant.id} value={grant.id}>{grant.title}</MenuItem>)}
              </TextField>
              <TextField required label="Название проекта" fullWidth error={Boolean(errors.project_name)} helperText={errors.project_name?.message} {...register("project_name", { required: "Введите название проекта" })} />
              <TextField required label="Описание проекта" multiline minRows={6} fullWidth error={Boolean(errors.description)} helperText={errors.description?.message} {...register("description", { required: "Добавьте описание проекта" })} />
              <TextField required label="Запрашиваемая сумма, ₽" type="number" fullWidth error={Boolean(errors.requested_amount)} helperText={errors.requested_amount?.message} {...register("requested_amount", { required: "Укажите сумму", min: { value: 1, message: "Сумма должна быть больше нуля" } })} />
              <Button type="submit" variant="contained" size="large" disabled={isSubmitting || !grants.length}>{isSubmitting ? "Создаём…" : "Сохранить черновик"}</Button>
            </Stack>
          </Box>
        </Paper>
      )}
    </>
  );
}

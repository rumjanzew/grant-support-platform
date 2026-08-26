import { Alert, Box, Button, Grid, Paper, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { getApiErrorMessage } from "../api/errors";
import { organizationsApi } from "../api/services";
import { useAuth } from "../auth/AuthContext";
import { useNotify } from "../notifications/NotificationContext";
import type { Organization, OrganizationInput } from "../types";

interface OrganizationSetupFormProps {
  organization?: Organization;
  onSaved?: (organization: Organization) => void | Promise<void>;
  onCancel?: () => void;
}

const emptyOrganization: OrganizationInput = { kpp: "", city: "", street: "", house: "", postal_code: "", name: "", inn: "", ogrn: "", organization_type: "" };

function toInput(organization: Organization): OrganizationInput {
  return {
    name: organization.name,
    inn: organization.inn,
    kpp: organization.kpp,
    ogrn: organization.ogrn,
    organization_type: organization.organization_type,
    registration_date: organization.registration_date,
    city: organization.city,
    street: organization.street,
    house: organization.house,
    postal_code: organization.postal_code,
  };
}

export function OrganizationSetupForm({ organization, onSaved, onCancel }: OrganizationSetupFormProps = {}) {
  const { refreshUser } = useAuth();
  const notify = useNotify();
  const [error, setError] = useState("");
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<OrganizationInput>({ defaultValues: organization ? toInput(organization) : emptyOrganization });

  useEffect(() => {
    reset(organization ? toInput(organization) : emptyOrganization);
  }, [organization, reset]);

  const onSubmit = async (data: OrganizationInput) => {
    setError("");
    try {
      const response = organization
        ? await organizationsApi.update(data)
        : await organizationsApi.create(data);
      await refreshUser();
      notify(organization ? "Данные организации обновлены." : "Организация сохранена. Теперь можно создать заявку.");
      await onSaved?.(response.data);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: { xs: 3, md: 4 } }}>
      <Typography variant="h5">{organization ? "Редактирование организации" : "Сначала добавьте организацию"}</Typography>
      <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>{organization ? "Изменения будут использоваться в новых и существующих заявках." : "Заявка подаётся от имени организации. Эти данные будут связаны с вашим профилем."}</Typography>
      <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stack spacing={2.5}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField required label="Полное наименование" fullWidth error={Boolean(errors.name)} helperText={errors.name?.message} {...register("name", { required: "Введите название" })} />
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 4 }}><TextField required label="ИНН" fullWidth error={Boolean(errors.inn)} helperText={errors.inn?.message} {...register("inn", { required: "Введите ИНН", pattern: { value: /^\d{10}$|^\d{12}$/, message: "ИНН содержит 10 или 12 цифр" } })} /></Grid>
            <Grid size={{ xs: 12, sm: 4 }}><TextField label="КПП" fullWidth {...register("kpp")} /></Grid>
            <Grid size={{ xs: 12, sm: 4 }}><TextField required label="ОГРН / ОГРНИП" fullWidth error={Boolean(errors.ogrn)} helperText={errors.ogrn?.message} {...register("ogrn", { required: "Введите ОГРН", pattern: { value: /^\d{13}$|^\d{15}$/, message: "ОГРН содержит 13 или 15 цифр" } })} /></Grid>
          </Grid>
          <TextField required label="Тип организации" placeholder="НКО или МСП" fullWidth error={Boolean(errors.organization_type)} helperText={errors.organization_type?.message} {...register("organization_type", { required: "Укажите тип организации" })} />
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 4 }}><TextField label="Город" fullWidth {...register("city")} /></Grid>
            <Grid size={{ xs: 12, sm: 4 }}><TextField label="Улица" fullWidth {...register("street")} /></Grid>
            <Grid size={{ xs: 6, sm: 2 }}><TextField label="Дом" fullWidth {...register("house")} /></Grid>
            <Grid size={{ xs: 6, sm: 2 }}><TextField label="Индекс" fullWidth {...register("postal_code")} /></Grid>
          </Grid>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <Button type="submit" variant="contained" size="large" disabled={isSubmitting}>{isSubmitting ? "Сохраняем…" : "Сохранить организацию"}</Button>
            {onCancel && <Button size="large" onClick={onCancel} disabled={isSubmitting}>Отмена</Button>}
          </Stack>
        </Stack>
      </Box>
    </Paper>
  );
}

import { Alert, Box, Button, Checkbox, FormControlLabel, Grid, Link, Paper, Stack, TextField, Typography } from "@mui/material";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Link as RouterLink, useNavigate } from "react-router-dom";

import { getApiErrorMessage } from "../api/errors";
import { authApi } from "../api/services";
import { BrandLogo } from "../components/BrandLogo";
import { useNotify } from "../notifications/NotificationContext";

interface RegisterForm {
  email: string;
  password: string;
  password_confirm: string;
  last_name: string;
  first_name: string;
  middle_name: string;
  phone: string;
  consent_pd_agreed: boolean;
}

export function RegisterPage() {
  const navigate = useNavigate();
  const notify = useNotify();
  const [error, setError] = useState("");
  const { register, control, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<RegisterForm>({ defaultValues: { consent_pd_agreed: false } });
  const password = watch("password");

  const onSubmit = async (data: RegisterForm) => {
    setError("");
    try {
      await authApi.register(data as unknown as Record<string, unknown>);
      notify("Регистрация завершена. Теперь войдите в систему.");
      navigate("/login");
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    }
  };

  return (
    <Paper variant="outlined" sx={{ maxWidth: 760, mx: "auto", p: { xs: 3, sm: 4 } }}>
      <Box sx={{ display: "flex", justifyContent: "center", mb: 3 }}><BrandLogo to="/" /></Box>
      <Typography variant="h4" component="h1">Регистрация заявителя</Typography>
      <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>После регистрации будет назначена роль «Заявитель».</Typography>
      <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stack spacing={2.5}>
          {error && <Alert severity="error">{error}</Alert>}
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 4 }}><TextField required label="Фамилия" fullWidth error={Boolean(errors.last_name)} helperText={errors.last_name?.message} {...register("last_name", { required: "Введите фамилию" })} /></Grid>
            <Grid size={{ xs: 12, sm: 4 }}><TextField required label="Имя" fullWidth error={Boolean(errors.first_name)} helperText={errors.first_name?.message} {...register("first_name", { required: "Введите имя" })} /></Grid>
            <Grid size={{ xs: 12, sm: 4 }}><TextField label="Отчество" fullWidth {...register("middle_name")} /></Grid>
          </Grid>
          <TextField required label="Телефон" placeholder="+7 912 123-45-67" fullWidth error={Boolean(errors.phone)} helperText={errors.phone?.message} {...register("phone", { required: "Введите телефон" })} />
          <TextField required label="Email" type="email" autoComplete="email" fullWidth error={Boolean(errors.email)} helperText={errors.email?.message} {...register("email", { required: "Введите email" })} />
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}><TextField required label="Пароль" type="password" autoComplete="new-password" fullWidth error={Boolean(errors.password)} helperText={errors.password?.message ?? "Не менее 8 символов"} {...register("password", { required: "Введите пароль", minLength: { value: 8, message: "Минимум 8 символов" } })} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField required label="Повторите пароль" type="password" autoComplete="new-password" fullWidth error={Boolean(errors.password_confirm)} helperText={errors.password_confirm?.message} {...register("password_confirm", { required: "Повторите пароль", validate: (value) => value === password || "Пароли не совпадают" })} /></Grid>
          </Grid>
          <Controller name="consent_pd_agreed" control={control} rules={{ required: "Необходимо согласие" }} render={({ field }) => <FormControlLabel control={<Checkbox checked={field.value} onChange={(_, checked) => field.onChange(checked)} />} label="Я согласен(на) на обработку персональных данных" />} />
          {errors.consent_pd_agreed && <Typography color="error" variant="caption">{errors.consent_pd_agreed.message}</Typography>}
          <Button type="submit" size="large" variant="contained" disabled={isSubmitting}>{isSubmitting ? "Регистрируем…" : "Зарегистрироваться"}</Button>
          <Typography variant="body2" textAlign="center">Уже есть аккаунт? <Link component={RouterLink} to="/login">Войти</Link></Typography>
        </Stack>
      </Box>
    </Paper>
  );
}

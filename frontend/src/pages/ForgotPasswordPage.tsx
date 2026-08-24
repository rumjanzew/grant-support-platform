import { Alert, Box, Button, Link, Paper, Stack, TextField, Typography } from "@mui/material";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link as RouterLink } from "react-router-dom";

import { getApiErrorMessage } from "../api/errors";
import { authApi } from "../api/services";

interface ForgotPasswordForm { email: string; }

export function ForgotPasswordPage() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ForgotPasswordForm>();
  const onSubmit = async ({ email }: ForgotPasswordForm) => { setError(""); try { setMessage((await authApi.requestPasswordReset(email)).data.detail); } catch (requestError) { setError(getApiErrorMessage(requestError)); } };
  return <Paper variant="outlined" sx={{ maxWidth: 520, mx: "auto", p: { xs: 3, sm: 4 } }}><Typography variant="h4" component="h1">Восстановление пароля</Typography><Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>Укажите email. Если аккаунт существует, мы отправим ссылку для установки нового пароля.</Typography>{message ? <Stack spacing={2}><Alert severity="success">{message}</Alert><Button component={RouterLink} to="/login">Вернуться ко входу</Button></Stack> : <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate><Stack spacing={2.5}>{error && <Alert severity="error">{error}</Alert>}<TextField label="Email" type="email" autoComplete="email" fullWidth error={Boolean(errors.email)} helperText={errors.email?.message} {...register("email", { required: "Введите email" })} /><Button type="submit" variant="contained" size="large" disabled={isSubmitting}>{isSubmitting ? "Отправляем…" : "Получить ссылку"}</Button><Typography textAlign="center" variant="body2"><Link component={RouterLink} to="/login">Вспомнили пароль? Войти</Link></Typography></Stack></Box>}</Paper>;
}

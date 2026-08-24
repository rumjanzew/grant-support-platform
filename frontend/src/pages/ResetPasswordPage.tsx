import { Alert, Box, Button, Paper, Stack, TextField, Typography } from "@mui/material";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router-dom";

import { getApiErrorMessage } from "../api/errors";
import { authApi } from "../api/services";
import { useNotify } from "../notifications/NotificationContext";

interface ResetPasswordForm { password: string; password_confirm: string; }

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const uid = searchParams.get("uid") ?? "";
  const token = searchParams.get("token") ?? "";
  const navigate = useNavigate();
  const notify = useNotify();
  const [error, setError] = useState("");
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<ResetPasswordForm>();
  const password = watch("password");
  const onSubmit = async (data: ResetPasswordForm) => { setError(""); try { await authApi.confirmPasswordReset({ uid, token, ...data }); notify("Пароль изменён. Войдите с новым паролем."); navigate("/login", { replace: true }); } catch (requestError) { setError(getApiErrorMessage(requestError)); } };
  if (!uid || !token) return <Alert severity="error">Ссылка восстановления неполная. Запросите новую ссылку.</Alert>;
  return <Paper variant="outlined" sx={{ maxWidth: 520, mx: "auto", p: { xs: 3, sm: 4 } }}><Typography variant="h4" component="h1">Новый пароль</Typography><Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>Придумайте новый безопасный пароль для аккаунта.</Typography><Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate><Stack spacing={2.5}>{error && <Alert severity="error">{error}</Alert>}<TextField label="Новый пароль" type="password" autoComplete="new-password" fullWidth error={Boolean(errors.password)} helperText={errors.password?.message ?? "Не менее 8 символов"} {...register("password", { required: "Введите пароль", minLength: { value: 8, message: "Минимум 8 символов" } })} /><TextField label="Повторите пароль" type="password" autoComplete="new-password" fullWidth error={Boolean(errors.password_confirm)} helperText={errors.password_confirm?.message} {...register("password_confirm", { required: "Повторите пароль", validate: (value) => value === password || "Пароли не совпадают" })} /><Button type="submit" variant="contained" size="large" disabled={isSubmitting}>{isSubmitting ? "Сохраняем…" : "Установить новый пароль"}</Button></Stack></Box></Paper>;
}

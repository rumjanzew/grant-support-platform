import { Alert, Box, Button, Link, Paper, Stack, TextField, Typography } from "@mui/material";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";

import { getApiErrorMessage } from "../api/errors";
import { useAuth } from "../auth/AuthContext";
import { roleHome } from "../auth/RouteGuards";
import { BrandLogo } from "../components/BrandLogo";
import { PasswordField } from "../components/PasswordField";

interface LoginForm {
  email: string;
  password: string;
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState("");
  const successMessage = (location.state as { successMessage?: string } | null)?.successMessage;
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>();

  const onSubmit = async (data: LoginForm) => {
    setError("");
    try {
      const user = await login(data.email, data.password);
      const target = (location.state as { from?: string } | null)?.from;
      navigate(target || roleHome(user.role), { replace: true });
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    }
  };

  return (
    <Paper variant="outlined" sx={{ maxWidth: 480, mx: "auto", p: { xs: 3, sm: 4 } }}>
      <Box sx={{ display: "flex", justifyContent: "center", mb: 3 }}><BrandLogo to="/" /></Box>
      <Typography variant="h4" component="h1">Вход</Typography>
      <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>Войдите, чтобы управлять заявками.</Typography>
      <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stack spacing={2.5}>
          {successMessage && <Alert severity="success">{successMessage}</Alert>}
          {error && <Alert severity="error">{error}</Alert>}
          <TextField required label="Email" type="email" autoComplete="email" fullWidth error={Boolean(errors.email)} helperText={errors.email?.message} {...register("email", { required: "Введите email" })} />
          <PasswordField required label="Пароль" autoComplete="current-password" fullWidth error={Boolean(errors.password)} helperText={errors.password?.message} {...register("password", { required: "Введите пароль" })} />
          <Button type="submit" size="large" variant="contained" disabled={isSubmitting}>{isSubmitting ? "Входим…" : "Войти"}</Button>
          <Link component={RouterLink} to="/password-reset" textAlign="center">Забыли пароль?</Link>
          <Typography variant="body2" textAlign="center">Нет аккаунта? <Link component={RouterLink} to="/register">Зарегистрироваться</Link></Typography>
        </Stack>
      </Box>
    </Paper>
  );
}

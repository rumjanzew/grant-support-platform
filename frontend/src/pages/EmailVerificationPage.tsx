import { Alert, Button, Link, Paper, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { Link as RouterLink, useSearchParams } from "react-router-dom";

import { getApiErrorMessage } from "../api/errors";
import { authApi } from "../api/services";
import { useAuth } from "../auth/AuthContext";
import { LoadingState } from "../components/LoadingState";
import { useNotify } from "../notifications/NotificationContext";

type ConfirmationState = "idle" | "loading" | "success" | "error";

export function EmailVerificationPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [state, setState] = useState<ConfirmationState>(token ? "loading" : "idle");
  const [message, setMessage] = useState("");
  const [resending, setResending] = useState(false);
  const requestedToken = useRef<string | null>(null);
  const notify = useNotify();
  const { refreshUser } = useAuth();

  useEffect(() => {
    if (!token || requestedToken.current === token) return;
    requestedToken.current = token;
    setState("loading");
    void authApi.confirmEmail(token)
      .then(async (response) => {
        await refreshUser();
        setMessage(response.data.detail);
        setState("success");
      })
      .catch((error: unknown) => {
        setMessage(getApiErrorMessage(error));
        setState("error");
      });
  }, [refreshUser, token]);

  const resend = async () => {
    if (!email.trim()) return;
    setResending(true);
    try {
      const response = await authApi.resendEmailVerification(email.trim());
      notify(response.data.detail);
    } catch (error) {
      notify(getApiErrorMessage(error), "error");
    } finally {
      setResending(false);
    }
  };

  if (state === "loading") return <LoadingState label="Подтверждаем email…" />;

  return (
    <Paper variant="outlined" sx={{ maxWidth: 620, mx: "auto", p: { xs: 3, sm: 4 } }}>
      <Stack spacing={2.5}>
        <Typography variant="h4" component="h1">Подтверждение email</Typography>
        {state === "success" && <Alert severity="success">{message}</Alert>}
        {state === "error" && <Alert severity="error">{message}</Alert>}
        {state === "idle" && (
          <Alert severity="info">
            Аккаунт создан. Перейдите по ссылке из письма. Если письмо не пришло,
            запросите его повторно.
          </Alert>
        )}
        {state !== "success" && (
          <Stack spacing={1.5}>
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              fullWidth
              required
            />
            <Button
              variant="contained"
              onClick={() => void resend()}
              disabled={resending || !email.trim()}
            >
              {resending ? "Отправляем…" : "Отправить письмо повторно"}
            </Button>
          </Stack>
        )}
        <Typography variant="body2">
          <Link component={RouterLink} to="/login">Перейти ко входу</Link>
        </Typography>
      </Stack>
    </Paper>
  );
}

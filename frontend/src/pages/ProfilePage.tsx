import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";

import { getApiErrorMessage } from "../api/errors";
import { authApi, organizationsApi } from "../api/services";
import { tokenStorage } from "../api/tokenStorage";
import { useAuth } from "../auth/AuthContext";
import { LoadingState } from "../components/LoadingState";
import { OrganizationSetupForm } from "../components/OrganizationSetupForm";
import { PageHeader } from "../components/PageHeader";
import { StatusChip } from "../components/StatusChip";
import { useNotify } from "../notifications/NotificationContext";
import type { Organization, Profile, ProfileInput } from "../types";
import { formatDate } from "../utils/date";
import { getRoleLabel, organizationStatusLabels } from "../utils/labels";

interface PasswordForm {
  current_password: string;
  new_password: string;
  new_password_confirm: string;
}

export function ProfilePage() {
  const { refreshUser } = useAuth();
  const notify = useNotify();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [organizationEditing, setOrganizationEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ProfileInput>();
  const passwordForm = useForm<PasswordForm>();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await authApi.profile();
      setProfile(response.data);
      reset({
        first_name: response.data.first_name,
        last_name: response.data.last_name,
        middle_name: response.data.middle_name,
        phone: response.data.phone,
      });
      if (response.data.role === "Applicant" && response.data.organization) {
        setOrganization((await organizationsApi.me()).data);
      } else {
        setOrganization(null);
      }
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [reset]);

  useEffect(() => { void load(); }, [load]);

  const saveProfile = async (data: ProfileInput) => {
    try {
      const response = await authApi.updateProfile(data);
      setProfile(response.data);
      reset(data);
      await refreshUser();
      notify("Личные данные обновлены.");
    } catch (requestError) {
      notify(getApiErrorMessage(requestError), "error");
    }
  };

  const changePassword = async (data: PasswordForm) => {
    setPasswordError("");
    try {
      const response = await authApi.changePassword(data);
      tokenStorage.clear();
      window.dispatchEvent(new Event("auth:unauthorized"));
      notify(response.data.detail);
      navigate("/login", { replace: true });
    } catch (requestError) {
      setPasswordError(getApiErrorMessage(requestError));
    }
  };

  if (loading) return <LoadingState label="Загружаем профиль…" />;
  if (error || !profile) return <Alert severity="error" action={<Button color="inherit" onClick={load}>Повторить</Button>}>{error || "Не удалось загрузить профиль."}</Alert>;

  const address = organization
    ? [organization.postal_code, organization.city, organization.street, organization.house && `д. ${organization.house}`].filter(Boolean).join(", ") || "—"
    : "—";
  const passwordAdornment = (
    <InputAdornment position="end">
      <IconButton aria-label={showPasswords ? "Скрыть пароль" : "Показать пароль"} onClick={() => setShowPasswords((value) => !value)} edge="end">
        {showPasswords ? <VisibilityOffOutlinedIcon /> : <VisibilityOutlinedIcon />}
      </IconButton>
    </InputAdornment>
  );

  return (
    <>
      <PageHeader title="Профиль" subtitle="Личные данные, организация и безопасность учётной записи" />
      <Stack spacing={3}>
        <Paper variant="outlined" sx={{ p: { xs: 2.5, sm: 3, md: 4 } }}>
          <Typography variant="h5" sx={{ mb: 3 }}>Личные данные</Typography>
          <Box component="form" onSubmit={handleSubmit(saveProfile)} noValidate>
            <Grid container spacing={2.5}>
              <Grid size={{ xs: 12, sm: 6 }}><TextField required fullWidth label="Имя" error={Boolean(errors.first_name)} helperText={errors.first_name?.message} {...register("first_name", { required: "Укажите имя" })} /></Grid>
              <Grid size={{ xs: 12, sm: 6 }}><TextField required fullWidth label="Фамилия" error={Boolean(errors.last_name)} helperText={errors.last_name?.message} {...register("last_name", { required: "Укажите фамилию" })} /></Grid>
              <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Отчество" {...register("middle_name")} /></Grid>
              <Grid size={{ xs: 12, sm: 6 }}><TextField required fullWidth label="Телефон" error={Boolean(errors.phone)} helperText={errors.phone?.message} {...register("phone", { required: "Укажите телефон" })} /></Grid>
              <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Email" value={profile.email} slotProps={{ input: { readOnly: true } }} /></Grid>
              <Grid size={{ xs: 12, sm: 3 }}><TextField fullWidth label="Роль" value={getRoleLabel(profile.role)} slotProps={{ input: { readOnly: true } }} /></Grid>
              <Grid size={{ xs: 12, sm: 3 }}><TextField fullWidth label="Дата регистрации" value={formatDate(profile.created_at)} slotProps={{ input: { readOnly: true } }} /></Grid>
            </Grid>
            <Button type="submit" variant="contained" disabled={isSubmitting} sx={{ mt: 3 }}>{isSubmitting ? "Сохраняем…" : "Сохранить изменения"}</Button>
          </Box>
        </Paper>

        {profile.role === "Applicant" && (organizationEditing && organization ? (
          <OrganizationSetupForm organization={organization} onCancel={() => setOrganizationEditing(false)} onSaved={async (updated) => { setOrganization(updated); setOrganizationEditing(false); }} />
        ) : organization ? (
          <Paper variant="outlined" sx={{ p: { xs: 2.5, sm: 3, md: 4 } }}>
            <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={2} sx={{ mb: 3 }}>
              <Box><Typography variant="h5">Организация</Typography><Typography color="text.secondary" sx={{ mt: 0.5 }}>Данные заявителя, используемые в заявках</Typography></Box>
              <Button variant="outlined" startIcon={<EditOutlinedIcon />} onClick={() => setOrganizationEditing(true)}>Редактировать</Button>
            </Stack>
            <Grid container spacing={2.5}>
              <Grid size={{ xs: 12, md: 8 }}><Typography variant="caption" color="text.secondary">Название</Typography><Typography fontWeight={700}>{organization.name}</Typography></Grid>
              <Grid size={{ xs: 12, md: 4 }}><Typography variant="caption" color="text.secondary">Статус</Typography><Box sx={{ mt: 0.5 }}><StatusChip status={organization.status} label={organizationStatusLabels[organization.status]} /></Box></Grid>
              <Grid size={{ xs: 6, sm: 3 }}><Typography variant="caption" color="text.secondary">ИНН</Typography><Typography>{organization.inn}</Typography></Grid>
              <Grid size={{ xs: 6, sm: 3 }}><Typography variant="caption" color="text.secondary">КПП</Typography><Typography>{organization.kpp || "—"}</Typography></Grid>
              <Grid size={{ xs: 6, sm: 3 }}><Typography variant="caption" color="text.secondary">ОГРН</Typography><Typography>{organization.ogrn}</Typography></Grid>
              <Grid size={{ xs: 6, sm: 3 }}><Typography variant="caption" color="text.secondary">Тип</Typography><Typography>{organization.organization_type}</Typography></Grid>
              <Grid size={{ xs: 12 }}><Typography variant="caption" color="text.secondary">Адрес</Typography><Typography>{address}</Typography></Grid>
            </Grid>
          </Paper>
        ) : <OrganizationSetupForm onSaved={(created) => setOrganization(created)} />)}

        <Paper variant="outlined" sx={{ p: { xs: 2.5, sm: 3, md: 4 } }}>
          <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} gap={2}>
            <Box><Typography variant="h5">Безопасность</Typography><Typography color="text.secondary" sx={{ mt: 0.5 }}>Используйте уникальный пароль, который не применяется в других сервисах.</Typography></Box>
            <Button variant="outlined" startIcon={<LockOutlinedIcon />} onClick={() => setPasswordOpen(true)}>Изменить пароль</Button>
          </Stack>
        </Paper>
      </Stack>

      <Dialog open={passwordOpen} onClose={() => !passwordForm.formState.isSubmitting && setPasswordOpen(false)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={passwordForm.handleSubmit(changePassword)} noValidate>
          <DialogTitle>Изменение пароля</DialogTitle>
          <DialogContent><Stack spacing={2.25} sx={{ pt: 1 }}>
            {passwordError && <Alert severity="error">{passwordError}</Alert>}
            <TextField required fullWidth type={showPasswords ? "text" : "password"} label="Текущий пароль" error={Boolean(passwordForm.formState.errors.current_password)} helperText={passwordForm.formState.errors.current_password?.message} slotProps={{ input: { endAdornment: passwordAdornment } }} {...passwordForm.register("current_password", { required: "Введите текущий пароль" })} />
            <TextField required fullWidth type={showPasswords ? "text" : "password"} label="Новый пароль" error={Boolean(passwordForm.formState.errors.new_password)} helperText={passwordForm.formState.errors.new_password?.message || "Не менее 8 символов"} slotProps={{ input: { endAdornment: passwordAdornment } }} {...passwordForm.register("new_password", { required: "Введите новый пароль", minLength: { value: 8, message: "Пароль должен содержать не менее 8 символов" } })} />
            <TextField required fullWidth type={showPasswords ? "text" : "password"} label="Повтор нового пароля" error={Boolean(passwordForm.formState.errors.new_password_confirm)} helperText={passwordForm.formState.errors.new_password_confirm?.message} slotProps={{ input: { endAdornment: passwordAdornment } }} {...passwordForm.register("new_password_confirm", { required: "Повторите новый пароль", validate: (value) => value === passwordForm.getValues("new_password") || "Пароли не совпадают" })} />
          </Stack></DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}><Button onClick={() => setPasswordOpen(false)} disabled={passwordForm.formState.isSubmitting}>Отмена</Button><Button type="submit" variant="contained" disabled={passwordForm.formState.isSubmitting}>{passwordForm.formState.isSubmitting ? "Изменяем…" : "Изменить пароль"}</Button></DialogActions>
        </Box>
      </Dialog>
    </>
  );
}

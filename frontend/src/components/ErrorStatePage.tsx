import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import ExploreOutlinedIcon from "@mui/icons-material/ExploreOutlined";
import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import { Link as RouterLink, useNavigate } from "react-router-dom";

interface ErrorStatePageProps {
  code?: "403" | "404" | "500";
  title: string;
  description: string;
  showReload?: boolean;
}

const icons = {
  "403": <BlockOutlinedIcon sx={{ fontSize: 38 }} />,
  "404": <ExploreOutlinedIcon sx={{ fontSize: 38 }} />,
  "500": <ErrorOutlineIcon sx={{ fontSize: 38 }} />,
};

export function ErrorStatePage({ code, title, description, showReload = false }: ErrorStatePageProps) {
  const navigate = useNavigate();
  return (
    <Paper variant="outlined" sx={{ p: { xs: 4, md: 7 }, textAlign: "center", maxWidth: 720, mx: "auto" }}>
      <Stack spacing={2} alignItems="center">
        <Box sx={{ width: 72, height: 72, borderRadius: "50%", display: "grid", placeItems: "center", color: "primary.main", backgroundColor: "primary.light" }}>{icons[code ?? "500"]}</Box>
        {code && <Typography variant="h1" color="primary" fontWeight={800} sx={{ fontSize: { xs: "4rem", sm: "5.5rem" }, lineHeight: 1 }}>{code}</Typography>}
        <Typography variant="h5">{title}</Typography>
        <Typography color="text.secondary" sx={{ maxWidth: 480 }}>{description}</Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ pt: 1 }}>
          <Button variant="outlined" onClick={() => navigate(-1)}>Назад</Button>
          {showReload && <Button variant="outlined" onClick={() => window.location.reload()}>Обновить страницу</Button>}
          <Button component={RouterLink} to="/" variant="contained">На главную</Button>
        </Stack>
      </Stack>
    </Paper>
  );
}

export function ForbiddenPage() {
  return <ErrorStatePage code="403" title="Доступ запрещён" description="У вашей учётной записи нет прав для просмотра этой страницы." />;
}

export function UnexpectedErrorPage() {
  return <ErrorStatePage code="500" title="Что-то пошло не так" description="Произошла непредвиденная ошибка. Обновите страницу или вернитесь на главную." showReload />;
}

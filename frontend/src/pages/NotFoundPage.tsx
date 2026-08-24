import { Button, Paper, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

export function NotFoundPage() {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 4, md: 7 }, textAlign: "center" }}>
      <Stack spacing={2} alignItems="center">
        <Typography variant="h1" color="primary" fontWeight={800}>404</Typography>
        <Typography variant="h5">Страница не найдена</Typography>
        <Typography color="text.secondary">Возможно, адрес изменился или страница была удалена.</Typography>
        <Button component={RouterLink} to="/" variant="contained">На главную</Button>
      </Stack>
    </Paper>
  );
}

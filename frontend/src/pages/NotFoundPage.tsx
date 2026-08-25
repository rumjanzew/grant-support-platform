import ExploreOutlinedIcon from "@mui/icons-material/ExploreOutlined";
import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

export function NotFoundPage() {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 4, md: 7 }, textAlign: "center", maxWidth: 720, mx: "auto" }}>
      <Stack spacing={2} alignItems="center">
        <Box sx={{ width: 72, height: 72, borderRadius: "50%", display: "grid", placeItems: "center", color: "primary.main", backgroundColor: "#e8f1f4" }}><ExploreOutlinedIcon sx={{ fontSize: 38 }} /></Box>
        <Typography variant="h1" color="primary" fontWeight={800} sx={{ fontSize: { xs: "4rem", sm: "5.5rem" }, lineHeight: 1 }}>404</Typography>
        <Typography variant="h5">Страница не найдена</Typography>
        <Typography color="text.secondary">Возможно, адрес изменился или страница была удалена.</Typography>
        <Button component={RouterLink} to="/" variant="contained">На главную</Button>
      </Stack>
    </Paper>
  );
}

import { Box, CircularProgress, Typography } from "@mui/material";

export function LoadingState({ label = "Загрузка…" }: { label?: string }) {
  return (
    <Box sx={{ display: "grid", placeItems: "center", minHeight: 240, gap: 2 }}>
      <CircularProgress size={36} />
      <Typography color="text.secondary">{label}</Typography>
    </Box>
  );
}

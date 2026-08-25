import { Box, CircularProgress, Typography } from "@mui/material";

export function LoadingState({ label = "Загрузка…" }: { label?: string }) {
  return (
    <Box role="status" aria-live="polite" sx={{ display: "grid", placeItems: "center", minHeight: 260, gap: 2 }}>
      <CircularProgress size={34} thickness={4} />
      <Typography variant="body2" color="text.secondary" fontWeight={600}>{label}</Typography>
    </Box>
  );
}

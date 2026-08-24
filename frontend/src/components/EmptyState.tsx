import { Button, Paper, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

export function EmptyState({
  title,
  description,
  actionLabel,
  actionTo,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  actionTo?: string;
}) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 3, md: 5 }, textAlign: "center" }}>
      <Typography variant="h6" gutterBottom>{title}</Typography>
      <Typography color="text.secondary" sx={{ mb: actionLabel ? 3 : 0 }}>{description}</Typography>
      {actionLabel && actionTo && (
        <Button component={RouterLink} to={actionTo} variant="contained">{actionLabel}</Button>
      )}
    </Paper>
  );
}

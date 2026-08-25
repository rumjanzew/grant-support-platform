import InboxOutlinedIcon from "@mui/icons-material/InboxOutlined";
import { Box, Button, Paper, Typography } from "@mui/material";
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
    <Paper variant="outlined" sx={{ p: { xs: 3.5, md: 5 }, textAlign: "center", backgroundColor: "background.paper" }}>
      <Box sx={{ mx: "auto", mb: 2, width: 52, height: 52, borderRadius: "50%", display: "grid", placeItems: "center", color: "primary.main", backgroundColor: "primary.light" }}><InboxOutlinedIcon /></Box>
      <Typography variant="h6" gutterBottom>{title}</Typography>
      <Typography color="text.secondary" sx={{ mb: actionLabel ? 3 : 0 }}>{description}</Typography>
      {actionLabel && actionTo && (
        <Button component={RouterLink} to={actionTo} variant="contained">{actionLabel}</Button>
      )}
    </Paper>
  );
}

import { Box, Typography } from "@mui/material";

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: { xs: "flex-start", sm: "center" }, flexDirection: { xs: "column", sm: "row" }, gap: 2, mb: { xs: 3, md: 4 } }}>
      <Box>
        <Typography variant="h4" component="h1" sx={{ fontSize: { xs: "1.75rem", sm: "2.125rem" } }}>{title}</Typography>
        {subtitle && <Typography color="text.secondary" sx={{ mt: 0.75, maxWidth: 720 }}>{subtitle}</Typography>}
      </Box>
      {action}
    </Box>
  );
}

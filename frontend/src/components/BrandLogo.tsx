import { Box, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

interface BrandLogoProps {
  markOnly?: boolean;
  compactOnMobile?: boolean;
  inverted?: boolean;
  size?: number;
  to?: string;
}

export function BrandLogo({ markOnly = false, compactOnMobile = false, inverted = false, size = 34, to }: BrandLogoProps) {
  const markColor = inverted ? "#FFFFFF" : "#4F46E5";
  const detailColor = inverted ? "#4F46E5" : "#FFFFFF";
  const content = (
    <Stack component="span" direction="row" alignItems="center" spacing={1.1}>
      <Box component="svg" viewBox="0 0 40 40" aria-hidden="true" focusable="false" sx={{ width: size, height: size, display: "block", flexShrink: 0 }}>
        <rect x="2" y="2" width="36" height="36" rx="10" fill={markColor} />
        <path d="M10.5 26.5 17.8 19.2l4.7 4.7L30 16.4" fill="none" stroke={detailColor} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M24.8 15.8H30.5v5.7" fill="none" stroke={detailColor} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      </Box>
      {!markOnly && (
        <Typography component="span" variant="h6" sx={{ display: compactOnMobile ? { xs: "none", sm: "inline" } : "inline", color: inverted ? "#FFFFFF" : "primary.main", fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1 }}>
          GrantSupport
        </Typography>
      )}
    </Stack>
  );

  if (!to) return content;
  return <Box component={RouterLink} to={to} aria-label="GrantSupport" sx={{ display: "inline-flex", color: "inherit", textDecoration: "none", width: "fit-content" }}>{content}</Box>;
}

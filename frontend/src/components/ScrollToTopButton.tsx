import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import { Fab, Tooltip } from "@mui/material";
import { useEffect, useState } from "react";

export function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const updateVisibility = () => setVisible(window.scrollY > 350);
    updateVisibility();
    window.addEventListener("scroll", updateVisibility, { passive: true });
    return () => window.removeEventListener("scroll", updateVisibility);
  }, []);

  if (!visible) return null;

  return (
    <Tooltip title="Наверх" placement="left">
      <Fab
        color="primary"
        size="small"
        aria-label="Наверх"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        sx={{ position: "fixed", right: { xs: 16, sm: 24 }, bottom: { xs: 80, sm: 88 }, zIndex: (theme) => theme.zIndex.speedDial }}
      >
        <KeyboardArrowUpIcon />
      </Fab>
    </Tooltip>
  );
}

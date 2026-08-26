import AccountCircleOutlinedIcon from "@mui/icons-material/AccountCircleOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import { Box, ButtonBase, ListItemIcon, Menu, MenuItem, Typography } from "@mui/material";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { getRoleLabel } from "../utils/labels";

export function UserMenu() {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const openProfile = () => {
    setAnchorEl(null);
    navigate("/profile");
  };

  const handleLogout = async () => {
    setAnchorEl(null);
    await logout();
    navigate("/");
  };

  return (
    <>
      <ButtonBase
        aria-label="Открыть меню пользователя"
        aria-haspopup="menu"
        aria-expanded={Boolean(anchorEl)}
        onClick={(event) => setAnchorEl(event.currentTarget)}
        sx={{ display: "flex", alignItems: "center", gap: 1, p: 0.75, pr: { xs: 0.75, sm: 1.25 }, borderRadius: 2, textAlign: "left", flexShrink: 0, "&:hover": { backgroundColor: "#F6F6FA" } }}
      >
        <AccountCircleOutlinedIcon color="primary" />
        <Box sx={{ display: { xs: "none", sm: "block" }, lineHeight: 1.1, maxWidth: { sm: 230 } }}>
          <Typography variant="body2" fontWeight={700} noWrap>{user.first_name || user.email}</Typography>
          <Typography variant="caption" color="text.secondary" noWrap display="block">{getRoleLabel(user.role)} · {user.email}</Typography>
        </Box>
      </ButtonBase>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)} slotProps={{ paper: { sx: { mt: 1, minWidth: 190 } } }}>
        <MenuItem onClick={openProfile}><ListItemIcon><PersonOutlineIcon fontSize="small" /></ListItemIcon>Профиль</MenuItem>
        <MenuItem onClick={() => void handleLogout()}><ListItemIcon><LogoutOutlinedIcon fontSize="small" /></ListItemIcon>Выйти</MenuItem>
      </Menu>
    </>
  );
}

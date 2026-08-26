import MenuIcon from "@mui/icons-material/Menu";
import AccountCircleOutlinedIcon from "@mui/icons-material/AccountCircleOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import {
  AppBar,
  Box,
  Button,
  ButtonBase,
  Chip,
  Container,
  Divider,
  Drawer,
  Grid,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { Link as RouterLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { getRoleLabel } from "../utils/labels";

export function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [userMenuAnchor, setUserMenuAnchor] = useState<HTMLElement | null>(null);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const links = [
    { label: "Главная", to: "/" },
    { label: "Гранты", to: "/grants" },
    ...(user?.role === "Applicant" ? [{ label: "Мои заявки", to: "/applications" }] : []),
    ...(user?.role === "Administrator" ? [
      { label: "Обзор", to: "/admin" },
      { label: "Управление грантами", to: "/admin/grants" },
      { label: "Заявки", to: "/admin/applications" },
      { label: "Пользователи", to: "/admin/users" },
    ] : []),
    ...(user?.role === "Expert" ? [
      { label: "Кабинет", to: "/expert" },
      { label: "Назначенные заявки", to: "/expert/assignments" },
    ] : []),
  ];
  const footerNavigation = [
    { label: "Главная", to: "/" },
    { label: "Гранты", to: "/grants" },
    ...(user?.role === "Applicant" ? [{ label: "Мои заявки", to: "/applications" }] : []),
  ];
  const isActive = (to: string) =>
    location.pathname === to || (
      !["/", "/admin", "/expert"].includes(to)
      && location.pathname.startsWith(`${to}/`)
    );

  const handleLogout = async () => {
    setUserMenuAnchor(null);
    await logout();
    navigate("/");
  };

  const openProfile = () => {
    setUserMenuAnchor(null);
    navigate("/profile");
  };

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <AppBar position="sticky" elevation={0} sx={{ backgroundColor: "#FFFFFF", color: "text.primary" }}>
        <Toolbar sx={{ minHeight: { xs: 64, md: 70 } }}>
          <IconButton color="inherit" edge="start" onClick={() => setDrawerOpen(true)} sx={{ display: { md: "none" }, mr: 1 }} aria-label="Открыть меню">
            <MenuIcon />
          </IconButton>
          <Typography component={RouterLink} to="/" variant="h6" sx={{ color: "primary.main", textDecoration: "none", fontWeight: 800, letterSpacing: "-0.02em", flexGrow: { xs: 1, md: 0 }, mr: 3 }}>
            GrantSupport
          </Typography>
          <Stack direction="row" spacing={0.5} sx={{ display: { xs: "none", md: "flex" }, flexGrow: 1 }}>
            {links.map((link) => <Button key={link.to} component={RouterLink} to={link.to} aria-current={isActive(link.to) ? "page" : undefined} sx={{ position: "relative", minWidth: "auto", px: 1.25, fontSize: { md: "0.78rem", lg: "0.875rem" }, color: isActive(link.to) ? "primary.main" : "text.primary", backgroundColor: isActive(link.to) ? "#F0EFFE" : "transparent", "&:hover": { backgroundColor: isActive(link.to) ? "#E8E7FD" : "#F6F6FA", color: "primary.main" }, "&::after": isActive(link.to) ? { content: '""', position: "absolute", left: 10, right: 10, bottom: 3, height: 2, borderRadius: 2, backgroundColor: "primary.main" } : undefined }}>{link.label}</Button>)}
          </Stack>
          {user ? (
            <>
              <ButtonBase
                aria-label="Открыть меню пользователя"
                aria-haspopup="menu"
                aria-expanded={Boolean(userMenuAnchor)}
                onClick={(event) => setUserMenuAnchor(event.currentTarget)}
                sx={{ display: "flex", alignItems: "center", gap: 1, p: 0.75, pr: { xs: 0.75, sm: 1.25 }, borderRadius: 2, textAlign: "left", "&:hover": { backgroundColor: "#F6F6FA" } }}
              >
                <AccountCircleOutlinedIcon color="primary" />
                <Box sx={{ display: { xs: "none", sm: "block" }, lineHeight: 1.1 }}><Typography variant="body2" fontWeight={700}>{user.first_name || user.email}</Typography><Typography variant="caption" color="text.secondary">{getRoleLabel(user.role)} · {user.email}</Typography></Box>
              </ButtonBase>
              <Menu anchorEl={userMenuAnchor} open={Boolean(userMenuAnchor)} onClose={() => setUserMenuAnchor(null)} slotProps={{ paper: { sx: { mt: 1, minWidth: 190 } } }}>
                <MenuItem onClick={openProfile}><ListItemIcon><PersonOutlineIcon fontSize="small" /></ListItemIcon>Профиль</MenuItem>
                <MenuItem onClick={() => void handleLogout()}><ListItemIcon><LogoutOutlinedIcon fontSize="small" /></ListItemIcon>Выйти</MenuItem>
              </Menu>
            </>
          ) : (
            <Stack direction="row" spacing={1} sx={{ display: { xs: "none", sm: "flex" } }}>
              <Button component={RouterLink} to="/login">Войти</Button>
              <Button component={RouterLink} to="/register" variant="outlined">Регистрация</Button>
            </Stack>
          )}
        </Toolbar>
      </AppBar>
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <Box sx={{ width: { xs: 280, sm: 320 } }} role="navigation">
          <Typography variant="h6" sx={{ px: 2.5, py: 2.25, fontWeight: 800, color: "primary.main" }}>GrantSupport</Typography>
          {user && <Box sx={{ px: 2.5, pb: 2 }}><Typography fontWeight={750}>{[user.first_name, user.last_name].filter(Boolean).join(" ") || user.email}</Typography><Typography variant="body2" color="text.secondary" noWrap>{user.email}</Typography><Chip size="small" label={getRoleLabel(user.role)} sx={{ mt: 1 }} /></Box>}
          <Divider />
          <List sx={{ p: 1.25 }}>
            {links.map((link) => <ListItemButton key={link.to} component={RouterLink} to={link.to} selected={isActive(link.to)} aria-current={isActive(link.to) ? "page" : undefined} onClick={() => setDrawerOpen(false)} sx={{ mb: 0.5, borderRadius: 2, "&.Mui-selected": { color: "primary.main", backgroundColor: "#F0EFFE", borderLeft: "3px solid", borderColor: "primary.main" }, "&.Mui-selected:hover": { backgroundColor: "#E8E7FD" } }}><ListItemText primary={link.label} slotProps={{ primary: { fontWeight: isActive(link.to) ? 750 : 500 } }} /></ListItemButton>)}
          </List>
          {!user && <><Divider /><List><ListItemButton component={RouterLink} to="/login"><ListItemText primary="Войти" /></ListItemButton><ListItemButton component={RouterLink} to="/register"><ListItemText primary="Регистрация" /></ListItemButton></List></>}
        </Box>
      </Drawer>
      <Container component="main" maxWidth="lg" sx={{ flex: 1, py: { xs: 3, md: 5 }, px: { xs: 2, sm: 3 } }}>
        <Outlet />
      </Container>
      <Box component="footer" sx={{ backgroundColor: "#24214D", color: "#FFFFFF", py: { xs: 4, md: 5 }, mt: 4 }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 4, md: 6 }}>
            <Grid size={{ xs: 12, md: 5 }}>
              <Typography variant="h6" fontWeight={800} sx={{ color: "#FFFFFF", mb: 1.5 }}>GrantSupport</Typography>
              <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.72)", maxWidth: 340, whiteSpace: "pre-line" }}>Платформа грантовой поддержки{`\n`}субъектов МСП и НКО{`\n`}Республики Коми</Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Typography variant="subtitle2" fontWeight={750} sx={{ mb: 1.5 }}>Навигация</Typography>
              <Stack spacing={1.1}>{footerNavigation.map((link) => <Typography key={link.to} component={RouterLink} to={link.to} variant="body2" sx={{ color: "rgba(255,255,255,0.72)", textDecoration: "none", width: "fit-content", "&:hover": { color: "#FFFFFF", textDecoration: "underline" } }}>{link.label}</Typography>)}</Stack>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <Typography variant="subtitle2" fontWeight={750} sx={{ mb: 1.5 }}>Информация</Typography>
              <Stack spacing={1.1}>{["О платформе", "Поддержка", "Политика конфиденциальности"].map((item) => <Typography key={item} variant="body2" sx={{ color: "rgba(255,255,255,0.72)" }}>{item}</Typography>)}</Stack>
            </Grid>
          </Grid>
          <Divider sx={{ my: 3, borderColor: "rgba(255,255,255,0.14)" }} />
          <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1}>
            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.62)" }}>© 2026 GrantSupport</Typography>
            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.62)" }}>Учебный проект</Typography>
          </Stack>
        </Container>
      </Box>
    </Box>
  );
}

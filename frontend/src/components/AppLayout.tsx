import MenuIcon from "@mui/icons-material/Menu";
import AccountCircleOutlinedIcon from "@mui/icons-material/AccountCircleOutlined";
import {
  AppBar,
  Box,
  Button,
  Chip,
  Container,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { Link as RouterLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";

export function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const links = [
    { label: "Главная", to: "/" },
    { label: "Гранты", to: "/grants" },
    ...(user?.role === "Applicant" ? [{ label: "Мои заявки", to: "/applications" }] : []),
    ...(user?.role === "Administrator" ? [
      { label: "Панель", to: "/admin" },
      { label: "Управление грантами", to: "/admin/grants" },
      { label: "Заявки", to: "/admin/applications" },
      { label: "Пользователи", to: "/admin/users" },
    ] : []),
    ...(user?.role === "Expert" ? [
      { label: "Кабинет", to: "/expert" },
      { label: "Назначенные заявки", to: "/expert/assignments" },
    ] : []),
  ];
  const roleLabels: Record<string, string> = { Applicant: "Заявитель", Expert: "Эксперт", Administrator: "Администратор" };

  const isActive = (to: string) =>
    location.pathname === to || (
      !["/", "/admin", "/expert"].includes(to)
      && location.pathname.startsWith(`${to}/`)
    );

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <AppBar position="sticky" elevation={0}>
        <Toolbar sx={{ minHeight: { xs: 64, md: 70 } }}>
          <IconButton color="inherit" edge="start" onClick={() => setDrawerOpen(true)} sx={{ display: { md: "none" }, mr: 1 }} aria-label="Открыть меню">
            <MenuIcon />
          </IconButton>
          <Typography component={RouterLink} to="/" variant="h6" sx={{ color: "inherit", textDecoration: "none", fontWeight: 800, letterSpacing: "-0.02em", flexGrow: { xs: 1, md: 0 }, mr: 3 }}>
            GrantSupport <Box component="span" sx={{ display: { xs: "none", lg: "inline" }, fontWeight: 500, opacity: 0.72 }}>· Республика Коми</Box>
          </Typography>
          <Stack direction="row" spacing={0.5} sx={{ display: { xs: "none", md: "flex" }, flexGrow: 1 }}>
            {links.map((link) => <Button key={link.to} component={RouterLink} to={link.to} color="inherit" aria-current={isActive(link.to) ? "page" : undefined} sx={{ position: "relative", minWidth: "auto", px: 1.25, fontSize: { md: "0.78rem", lg: "0.875rem" }, opacity: isActive(link.to) ? 1 : 0.82, backgroundColor: isActive(link.to) ? "rgba(255,255,255,0.13)" : "transparent", "&::after": isActive(link.to) ? { content: '""', position: "absolute", left: 10, right: 10, bottom: 3, height: 2, borderRadius: 2, backgroundColor: "currentColor" } : undefined }}>{link.label}</Button>)}
          </Stack>
          {user ? (
            <Stack direction="row" spacing={1} alignItems="center" sx={{ display: { xs: "none", sm: "flex" } }}>
              <AccountCircleOutlinedIcon fontSize="small" />
              <Box sx={{ lineHeight: 1.1 }}><Typography variant="body2" fontWeight={700}>{user.first_name || user.email}</Typography><Typography variant="caption" sx={{ opacity: 0.75 }}>{roleLabels[user.role] ?? user.role}</Typography></Box>
              <Button color="inherit" onClick={handleLogout}>Выйти</Button>
            </Stack>
          ) : (
            <Stack direction="row" spacing={1} sx={{ display: { xs: "none", sm: "flex" } }}>
              <Button component={RouterLink} to="/login" color="inherit">Войти</Button>
              <Button component={RouterLink} to="/register" color="inherit" variant="outlined">Регистрация</Button>
            </Stack>
          )}
        </Toolbar>
      </AppBar>
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <Box sx={{ width: { xs: 280, sm: 320 } }} role="navigation">
          <Typography variant="h6" sx={{ px: 2.5, py: 2.25, fontWeight: 800, color: "primary.main" }}>GrantSupport</Typography>
          {user && <Box sx={{ px: 2.5, pb: 2 }}><Typography fontWeight={750}>{[user.first_name, user.last_name].filter(Boolean).join(" ") || user.email}</Typography><Typography variant="body2" color="text.secondary" noWrap>{user.email}</Typography><Chip size="small" label={roleLabels[user.role] ?? user.role} sx={{ mt: 1 }} /></Box>}
          <Divider />
          <List sx={{ p: 1.25 }}>
            {links.map((link) => <ListItemButton key={link.to} component={RouterLink} to={link.to} selected={isActive(link.to)} aria-current={isActive(link.to) ? "page" : undefined} onClick={() => setDrawerOpen(false)} sx={{ mb: 0.5, borderRadius: 2, "&.Mui-selected": { color: "primary.dark", backgroundColor: "#e6f0f3", borderLeft: "3px solid", borderColor: "primary.main" } }}><ListItemText primary={link.label} slotProps={{ primary: { fontWeight: isActive(link.to) ? 750 : 500 } }} /></ListItemButton>)}
          </List>
          <Divider />
          <List>
            {user ? <ListItemButton onClick={handleLogout}><ListItemText primary="Выйти" secondary={user.email} /></ListItemButton> : <><ListItemButton component={RouterLink} to="/login"><ListItemText primary="Войти" /></ListItemButton><ListItemButton component={RouterLink} to="/register"><ListItemText primary="Регистрация" /></ListItemButton></>}
          </List>
        </Box>
      </Drawer>
      <Container component="main" maxWidth="lg" sx={{ flex: 1, py: { xs: 3, md: 5 }, px: { xs: 2, sm: 3 } }}>
        <Outlet />
      </Container>
      <Box component="footer" sx={{ borderTop: 1, borderColor: "divider", backgroundColor: "background.paper", py: 3, mt: 4 }}>
        <Container maxWidth="lg"><Typography variant="body2" color="text.secondary">Учебная платформа грантовой поддержки Республики Коми</Typography></Container>
      </Box>
    </Box>
  );
}

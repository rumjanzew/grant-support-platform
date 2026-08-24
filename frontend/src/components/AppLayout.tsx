import MenuIcon from "@mui/icons-material/Menu";
import {
  AppBar,
  Box,
  Button,
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
  ];

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <AppBar position="sticky" elevation={0}>
        <Toolbar>
          <IconButton color="inherit" edge="start" onClick={() => setDrawerOpen(true)} sx={{ display: { md: "none" }, mr: 1 }} aria-label="Открыть меню">
            <MenuIcon />
          </IconButton>
          <Typography component={RouterLink} to="/" variant="h6" sx={{ color: "inherit", textDecoration: "none", fontWeight: 800, flexGrow: { xs: 1, md: 0 }, mr: 4 }}>
            GrantSupport
          </Typography>
          <Stack direction="row" spacing={0.5} sx={{ display: { xs: "none", md: "flex" }, flexGrow: 1 }}>
            {links.map((link) => <Button key={link.to} component={RouterLink} to={link.to} color="inherit" variant={location.pathname === link.to ? "outlined" : "text"}>{link.label}</Button>)}
          </Stack>
          {user ? (
            <Stack direction="row" spacing={1} alignItems="center" sx={{ display: { xs: "none", sm: "flex" } }}>
              <Typography variant="body2">{user.first_name || user.email}</Typography>
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
        <Box sx={{ width: 280 }} role="navigation">
          <Typography variant="h6" sx={{ p: 2, fontWeight: 800 }}>GrantSupport</Typography>
          <Divider />
          <List>
            {links.map((link) => <ListItemButton key={link.to} component={RouterLink} to={link.to} selected={location.pathname === link.to} onClick={() => setDrawerOpen(false)}><ListItemText primary={link.label} /></ListItemButton>)}
          </List>
          <Divider />
          <List>
            {user ? <ListItemButton onClick={handleLogout}><ListItemText primary="Выйти" secondary={user.email} /></ListItemButton> : <><ListItemButton component={RouterLink} to="/login"><ListItemText primary="Войти" /></ListItemButton><ListItemButton component={RouterLink} to="/register"><ListItemText primary="Регистрация" /></ListItemButton></>}
          </List>
        </Box>
      </Drawer>
      <Container component="main" maxWidth="lg" sx={{ flex: 1, py: { xs: 3, md: 5 } }}>
        <Outlet />
      </Container>
      <Box component="footer" sx={{ borderTop: 1, borderColor: "divider", py: 3, mt: 4 }}>
        <Container maxWidth="lg"><Typography variant="body2" color="text.secondary">Учебная платформа грантовой поддержки Республики Коми</Typography></Container>
      </Box>
    </Box>
  );
}

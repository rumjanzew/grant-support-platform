import ArrowBackOutlinedIcon from "@mui/icons-material/ArrowBackOutlined";
import AssignmentOutlinedIcon from "@mui/icons-material/AssignmentOutlined";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";
import MenuIcon from "@mui/icons-material/Menu";
import PeopleOutlineIcon from "@mui/icons-material/PeopleOutline";
import {
  AppBar,
  Box,
  Container,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { Link as RouterLink, Outlet, useLocation } from "react-router-dom";

import { UserMenu } from "./UserMenu";

const drawerWidth = 260;
const adminLinks = [
  { label: "Обзор", to: "/admin", icon: <DashboardOutlinedIcon /> },
  { label: "Гранты", to: "/admin/grants", icon: <LocalOfferOutlinedIcon /> },
  { label: "Заявки", to: "/admin/applications", icon: <AssignmentOutlinedIcon /> },
  { label: "Пользователи", to: "/admin/users", icon: <PeopleOutlineIcon /> },
];

export function AdminLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const isActive = (to: string) => to === "/admin" ? location.pathname === to : location.pathname.startsWith(`${to}/`) || location.pathname === to;
  const currentSection = [...adminLinks].reverse().find((link) => isActive(link.to))?.label ?? "Администрирование";

  const navigation = (closeDrawer = false) => (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }} role="navigation" aria-label="Административная навигация">
      <Box sx={{ px: 3, py: 2.5 }}>
        <Typography component={RouterLink} to="/admin" variant="h6" sx={{ color: "primary.main", textDecoration: "none", fontWeight: 800, letterSpacing: "-0.02em" }}>GrantSupport</Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25 }}>Администрирование</Typography>
      </Box>
      <Divider />
      <List sx={{ p: 1.5 }}>
        {adminLinks.map((link) => (
          <ListItemButton
            key={link.to}
            component={RouterLink}
            to={link.to}
            selected={isActive(link.to)}
            aria-current={isActive(link.to) ? "page" : undefined}
            onClick={() => closeDrawer && setDrawerOpen(false)}
            sx={{ mb: 0.5, borderRadius: 2, "&.Mui-selected": { color: "primary.main", backgroundColor: "primary.light" }, "&.Mui-selected:hover": { backgroundColor: "#E8E7FD" } }}
          >
            <ListItemIcon sx={{ minWidth: 40, color: isActive(link.to) ? "primary.main" : "text.secondary" }}>{link.icon}</ListItemIcon>
            <ListItemText primary={link.label} slotProps={{ primary: { fontWeight: isActive(link.to) ? 750 : 500 } }} />
          </ListItemButton>
        ))}
      </List>
      <Box sx={{ mt: "auto", p: 1.5 }}>
        <Divider sx={{ mb: 1.5 }} />
        <ListItemButton component={RouterLink} to="/" onClick={() => closeDrawer && setDrawerOpen(false)} sx={{ borderRadius: 2 }}>
          <ListItemIcon sx={{ minWidth: 40, color: "text.secondary" }}><ArrowBackOutlinedIcon /></ListItemIcon>
          <ListItemText primary="Вернуться на сайт" />
        </ListItemButton>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", width: "100%", overflowX: "hidden" }}>
      <Box component="nav" aria-label="Административные разделы" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ display: { xs: "block", md: "none" }, "& .MuiDrawer-paper": { width: drawerWidth, maxWidth: "calc(100vw - 40px)", boxSizing: "border-box" } }}
        >
          {navigation(true)}
        </Drawer>
        <Drawer
          variant="permanent"
          open
          sx={{ display: { xs: "none", md: "block" }, "& .MuiDrawer-paper": { width: drawerWidth, boxSizing: "border-box", borderColor: "divider", backgroundColor: "background.paper" } }}
        >
          {navigation()}
        </Drawer>
      </Box>
      <Box sx={{ minWidth: 0, flex: 1, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <AppBar position="sticky" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: "divider", backgroundColor: "rgba(255,255,255,0.96)" }}>
          <Toolbar sx={{ minHeight: { xs: 64, md: 70 }, px: { xs: 1.5, sm: 3 } }}>
            <IconButton edge="start" onClick={() => setDrawerOpen(true)} sx={{ display: { md: "none" }, mr: 1 }} aria-label="Открыть административное меню"><MenuIcon /></IconButton>
            <Typography variant="h6" component="div" noWrap sx={{ flex: 1, minWidth: 0, fontWeight: 750 }}>{currentSection}</Typography>
            <UserMenu />
          </Toolbar>
        </AppBar>
        <Container component="main" maxWidth="xl" sx={{ flex: 1, minWidth: 0, py: { xs: 3, md: 4 }, px: { xs: 2, sm: 3, lg: 4 } }}>
          <Outlet />
        </Container>
      </Box>
    </Box>
  );
}

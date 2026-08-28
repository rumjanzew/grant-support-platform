import { CssBaseline, ThemeProvider } from "@mui/material";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import { initYandexMetrika } from "./analytics/yandexMetrika";
import { AuthProvider } from "./auth/AuthContext";
import { NotificationProvider } from "./notifications/NotificationContext";
import { NotificationCenterProvider } from "./notifications/NotificationCenterContext";
import { FrontendErrorBoundary } from "./components/FrontendErrorBoundary";
import { theme } from "./theme";
import "./styles.css";

initYandexMetrika();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <FrontendErrorBoundary>
          <NotificationProvider>
            <AuthProvider>
              <NotificationCenterProvider>
                <App />
              </NotificationCenterProvider>
            </AuthProvider>
          </NotificationProvider>
        </FrontendErrorBoundary>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
);

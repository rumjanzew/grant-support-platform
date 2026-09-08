import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";

import {
  getAnalyticsConsent,
  OPEN_ANALYTICS_SETTINGS_EVENT,
  setAnalyticsConsent,
  type AnalyticsConsentValue,
} from "../analytics/analyticsConsent";
import {
  disableYandexMetrika,
  trackYandexMetrikaPageView,
} from "../analytics/yandexMetrika";

export function AnalyticsConsent() {
  const [consent, setConsent] = useState<AnalyticsConsentValue | null>(
    getAnalyticsConsent,
  );
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const openSettings = () => setSettingsOpen(true);
    window.addEventListener(OPEN_ANALYTICS_SETTINGS_EVENT, openSettings);
    return () => window.removeEventListener(OPEN_ANALYTICS_SETTINGS_EVENT, openSettings);
  }, []);

  const updateConsent = (value: AnalyticsConsentValue) => {
    setAnalyticsConsent(value);
    setConsent(value);
    setSettingsOpen(false);

    if (value === "accepted") {
      trackYandexMetrikaPageView();
    } else {
      disableYandexMetrika();
    }
  };

  return (
    <>
      {consent === null && (
        <Paper
          role="region"
          aria-labelledby="analytics-consent-title"
          elevation={8}
          sx={{
            position: "fixed",
            zIndex: (theme) => theme.zIndex.modal - 1,
            left: { xs: 8, sm: 24 },
            right: { xs: 8, sm: 24 },
            bottom: { xs: 8, sm: 20 },
            maxWidth: 920,
            mx: "auto",
            p: { xs: 2, sm: 2.5 },
            border: 1,
            borderColor: "divider",
          }}
        >
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            alignItems={{ md: "center" }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography id="analytics-consent-title" variant="h6" gutterBottom>
                Использование файлов cookie и аналитики
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Сайт использует технические средства хранения данных, необходимые
                для работы сервиса, а также Яндекс.Метрику для сбора обезличенной
                статистики посещений и улучшения работы платформы. Вы можете
                разрешить или отклонить использование аналитики.
              </Typography>
            </Box>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              sx={{ flexShrink: 0 }}
            >
              <Button
                variant="outlined"
                fullWidth
                onClick={() => updateConsent("declined")}
              >
                Отклонить
              </Button>
              <Button
                variant="contained"
                fullWidth
                onClick={() => updateConsent("accepted")}
              >
                Принять
              </Button>
            </Stack>
          </Stack>
        </Paper>
      )}

      <Dialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        fullWidth
        maxWidth="sm"
        aria-labelledby="analytics-settings-title"
      >
        <DialogTitle id="analytics-settings-title">Настройки аналитики</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            <Typography color="text.secondary">
              Яндекс.Метрика используется для сбора обезличенной статистики
              посещений и улучшения работы платформы.
            </Typography>
            <Alert severity={consent === "accepted" ? "success" : "info"}>
              {consent === "accepted"
                ? "Аналитика сейчас разрешена."
                : "Аналитика сейчас отключена."}
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, flexWrap: "wrap", gap: 1 }}>
          <Button onClick={() => setSettingsOpen(false)}>Отмена</Button>
          <Button variant="outlined" onClick={() => updateConsent("declined")}>
            Отключить аналитику
          </Button>
          <Button variant="contained" onClick={() => updateConsent("accepted")}>
            Разрешить аналитику
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

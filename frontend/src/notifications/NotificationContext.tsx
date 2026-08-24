import { Alert, Snackbar, type AlertColor } from "@mui/material";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

interface NotificationState {
  message: string;
  severity: AlertColor;
}

const NotificationContext = createContext<
  ((message: string, severity?: AlertColor) => void) | null
>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notification, setNotification] = useState<NotificationState | null>(null);
  const notify = useCallback((message: string, severity: AlertColor = "success") => {
    setNotification({ message, severity });
  }, []);
  const value = useMemo(() => notify, [notify]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <Snackbar
        open={Boolean(notification)}
        autoHideDuration={4500}
        onClose={() => setNotification(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={notification?.severity ?? "success"} variant="filled">
          {notification?.message}
        </Alert>
      </Snackbar>
    </NotificationContext.Provider>
  );
}

export function useNotify() {
  const notify = useContext(NotificationContext);
  if (!notify) throw new Error("useNotify must be used inside NotificationProvider");
  return notify;
}

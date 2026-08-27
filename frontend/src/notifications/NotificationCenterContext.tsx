import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { notificationsApi } from "../api/services";
import { useAuth } from "../auth/AuthContext";

interface NotificationCenterValue {
  unreadCount: number;
  refreshUnread: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

const NotificationCenterContext = createContext<NotificationCenterValue | null>(null);

export function NotificationCenterProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnread = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    const response = await notificationsApi.unreadCount();
    setUnreadCount(response.data.count);
  }, [user]);

  useEffect(() => {
    void refreshUnread().catch(() => setUnreadCount(0));
  }, [refreshUnread]);

  const markRead = useCallback(async (id: string) => {
    await notificationsApi.read(id);
    await refreshUnread();
  }, [refreshUnread]);

  const markAllRead = useCallback(async () => {
    await notificationsApi.markAllRead();
    setUnreadCount(0);
  }, []);

  const value = useMemo(
    () => ({ unreadCount, refreshUnread, markRead, markAllRead }),
    [markAllRead, markRead, refreshUnread, unreadCount],
  );
  return <NotificationCenterContext.Provider value={value}>{children}</NotificationCenterContext.Provider>;
}

export function useNotificationCenter() {
  const context = useContext(NotificationCenterContext);
  if (!context) throw new Error("useNotificationCenter must be used inside NotificationCenterProvider");
  return context;
}

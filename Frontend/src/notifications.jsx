import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import api from './api.js';
import { useAuth } from './auth.jsx';
import { useToast } from './components/Toast.jsx';

const NotificationContext = createContext(null);
const FEED_LIMIT = 30;

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [live, setLive] = useState(false);
  const listeners = useRef(new Set());

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications');
      setItems(data.items);
      setUnread(data.unread);
    } catch { /* the badge is not worth surfacing an error for */ }
  }, []);

  useEffect(() => {
    if (!user) {
      setItems([]);
      setUnread(0);
      setLive(false);
      return;
    }

    refresh();

    // EventSource reconnects by itself, so there is no retry logic here.
    const stream = new EventSource('/api/notifications/stream', { withCredentials: true });
    stream.addEventListener('ready', () => setLive(true));
    stream.onerror = () => setLive(false);
    stream.onmessage = (event) => {
      let note;
      try { note = JSON.parse(event.data); } catch { return; }

      setItems((prev) => [note, ...prev.filter(n => n._id !== note._id)].slice(0, FEED_LIMIT));
      setUnread((n) => n + 1);
      toast.info(note.title);
      listeners.current.forEach((fn) => fn(note));
    };

    return () => stream.close();
  }, [user, refresh, toast]);

  const markRead = useCallback(async (id) => {
    setItems((prev) => prev.map(n => (n._id === id ? { ...n, read: true } : n)));
    setUnread((n) => Math.max(0, n - 1));
    try { await api.post(`/notifications/${id}/read`); } catch { refresh(); }
  }, [refresh]);

  const markAllRead = useCallback(async () => {
    setItems((prev) => prev.map(n => ({ ...n, read: true })));
    setUnread(0);
    try { await api.post('/notifications/read-all'); } catch { refresh(); }
  }, [refresh]);

  // Lets a dashboard reload itself the moment something relevant happens.
  const onNotification = useCallback((fn) => {
    listeners.current.add(fn);
    return () => listeners.current.delete(fn);
  }, []);

  const value = useMemo(
    () => ({ items, unread, live, refresh, markRead, markAllRead, onNotification }),
    [items, unread, live, refresh, markRead, markAllRead, onNotification],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used inside NotificationProvider');
  return ctx;
}

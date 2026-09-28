import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import Icon from './Icon';

function timeLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const age = Math.max(0, Date.now() - date.getTime());
  if (age < 60 * 1000) return 'Just now';
  if (age < 60 * 60 * 1000) return `${Math.floor(age / (60 * 1000))}m ago`;
  if (age < 24 * 60 * 60 * 1000) return `${Math.floor(age / (60 * 60 * 1000))}h ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function notificationTitle(notification) {
  if (notification.type === 'like') return 'Someone loved your artwork';
  if (notification.type === 'submission_status') return notification.title || 'Your submission was updated';
  if (notification.type === 'exhibit') return 'A new exhibit is calling';
  return notification.title || 'ArtVault update';
}

function notificationIcon(type) {
  if (type === 'like') return 'likes';
  if (type === 'submission_status') return 'status';
  if (type === 'exhibit') return 'exhibits';
  return 'bell';
}

function notificationTypeLabel(type) {
  if (type === 'like') return 'Like';
  if (type === 'submission_status') return 'Submission';
  if (type === 'exhibit') return 'Exhibit';
  return 'Update';
}

export default function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (user?.role !== 'artist') {
      setNotifications([]);
      setUnreadCount(0);
      return undefined;
    }
    let cancelled = false;
    const load = () => {
      if (document.visibilityState !== 'visible') return;
      api.get('/notifications', { params: { limit: 20 } }).then((response) => {
        if (!cancelled) {
          setNotifications(response.data.notifications || []);
          setUnreadCount(response.data.unreadCount || 0);
        }
      }).catch(() => { /* Notifications are optional and must not block the app. */ });
    };
    load();
    const timer = window.setInterval(load, 60000);
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    const onNotificationsChanged = () => load();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('artvault:notifications-changed', onNotificationsChanged);
    return () => { cancelled = true; window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('artvault:notifications-changed', onNotificationsChanged); };
  }, [user?.id, user?.role]);

  if (user?.role !== 'artist') return null;

  async function markRead(notification) {
    if (!notification.isRead) {
      await api.patch(`/notifications/${notification._id}/read`).catch(() => null);
      setNotifications((current) => current.map((item) => item._id === notification._id ? { ...item, isRead: true } : item));
      setUnreadCount((count) => Math.max(0, count - 1));
    }
    setOpen(false);
    if (notification.type === 'exhibit' && notification.exhibit?._id) navigate(`/exhibits/${notification.exhibit._id}`);
    else if (notification.artwork?._id) navigate(`/artworks/${notification.artwork._id}`);
    else if (notification.type === 'submission_status') navigate('/exhibit-submission-status');
  }

  async function markAllRead() {
    await api.patch('/notifications/read-all').catch(() => null);
    setNotifications((current) => current.map((item) => ({ ...item, isRead: true })));
    setUnreadCount(0);
  }

  return (
    <div className="notification-wrap">
      <button className="notification-trigger" type="button" aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <Icon name="bell" size={18} />
        {unreadCount > 0 && <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>
      {open && <div className="notification-panel" role="dialog" aria-label="Notifications">
        <div className="notification-panel-head"><div><strong>Notifications</strong><span>{unreadCount ? `${unreadCount} new update${unreadCount === 1 ? '' : 's'}` : 'You’re all caught up'}</span></div>{unreadCount > 0 && <button type="button" onClick={markAllRead}>Mark all read</button>}</div>
        {notifications.length === 0 && <div className="notification-empty">You&apos;re all caught up.</div>}
        {notifications.map((notification) => <button className={`notification-item notification-${notification.type || 'general'}${notification.isRead ? '' : ' unread'}`} type="button" key={notification._id} onClick={() => markRead(notification)}>
          <span className="notification-item-icon"><Icon name={notificationIcon(notification.type)} size={16} /></span>
          <span className="notification-item-copy"><span className="notification-item-title">{notificationTitle(notification)} <small>{notificationTypeLabel(notification.type)}</small></span><span className="notification-item-message">{notification.message}</span><span className="notification-item-date">{timeLabel(notification.createdAt)}</span></span>
          {!notification.isRead && <span className="notification-unread-dot" aria-label="Unread" />}
        </button>)}
      </div>}
    </div>
  );
}

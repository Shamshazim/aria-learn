import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, NotificationDto } from '../api'

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function NotificationBell() {
  const navigate = useNavigate()
  const [count, setCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationDto[]>([])
  const ref = useRef<HTMLDivElement>(null)

  const refreshCount = () => api.unreadCount().then((r) => setCount(r.count)).catch(() => {})

  useEffect(() => {
    refreshCount()
    const id = window.setInterval(refreshCount, 30000)
    return () => window.clearInterval(id)
  }, [])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const toggle = async () => {
    const next = !open
    setOpen(next)
    if (next) {
      try { setItems(await api.notifications(15)) } catch { /* ignore */ }
    }
  }

  const markAll = async () => {
    await api.markNotificationsRead().catch(() => {})
    setItems((list) => list.map((n) => ({ ...n, read: true })))
    setCount(0)
  }

  const openItem = async (n: NotificationDto) => {
    if (!n.read) {
      await api.markNotificationsRead([n.id]).catch(() => {})
      setCount((c) => Math.max(0, c - 1))
    }
    setOpen(false)
    if (n.link) navigate(n.link)
  }

  return (
    <div className="notif" ref={ref}>
      <button className="notif-bell" onClick={toggle} aria-label="Notifications">
        🔔{count > 0 && <span className="notif-badge">{count > 9 ? '9+' : count}</span>}
      </button>
      {open && (
        <div className="notif-panel">
          <div className="notif-head">
            <strong>Notifications</strong>
            {items.some((n) => !n.read) && <button className="notif-mark" onClick={markAll}>Mark all read</button>}
          </div>
          {items.length === 0 && <div className="notif-empty">No notifications yet.</div>}
          <ul className="notif-list">
            {items.map((n) => (
              <li key={n.id} className={`notif-item ${n.read ? '' : 'notif-item--unread'}`} onClick={() => openItem(n)}>
                <div className="notif-title">{n.title}</div>
                <div className="notif-msg">{n.message}</div>
                <div className="notif-time">{timeAgo(n.createdAt)}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

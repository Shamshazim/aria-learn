import { FormEvent, useState } from 'react'
import { api } from '../api'

/** Lets the signed-in user change their own password. */
export default function ChangePassword() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setErr(null); setMsg(null)
    if (next.length < 6) { setErr('New password must be at least 6 characters.'); return }
    if (next !== confirm) { setErr('New passwords do not match.'); return }
    setBusy(true)
    try {
      await api.changePassword(current, next)
      setMsg('Password changed ✓')
      setCurrent(''); setNext(''); setConfirm('')
    } catch (e2) {
      setErr((e2 as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card">
      <h3>Change my password</h3>
      <form onSubmit={submit}>
        <label>Current password
          <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </label>
        <label>New password
          <input type="password" value={next} onChange={(e) => setNext(e.target.value)} />
        </label>
        <label>Confirm new password
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </label>
        {err && <div className="error">{err}</div>}
        {msg && <div className="success-note">{msg}</div>}
        <button className="btn btn--primary" disabled={busy}>{busy ? 'Saving...' : 'Update password'}</button>
      </form>
    </section>
  )
}

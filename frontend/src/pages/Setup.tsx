import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { api } from '../api'
import { useAuth } from '../auth'

const MIN_PASSWORD = 8

/**
 * The whole first-run experience: pick a username, pick a password, you're in.
 *
 * Everything else the app needs — the database, the curriculum, the AI — has already been
 * set up by the installer and the launcher before this screen renders, so there is nothing
 * technical left to ask a parent about.
 */
export default function Setup() {
  const { adoptSession } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Checked before we call the server so the parent gets an answer as they type, rather
  // than a round trip to be told the two passwords differ.
  const localProblem = (): string | null => {
    if (username.trim().length < 3) return 'Please choose a username of at least 3 characters.'
    if (/\s/.test(username.trim())) return 'Usernames cannot contain spaces.'
    if (password.length < MIN_PASSWORD) return `Please use a password of at least ${MIN_PASSWORD} characters.`
    if (password !== confirm) return 'The two passwords do not match.'
    return null
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const problem = localProblem()
    if (problem) { setError(problem); return }

    setError(null)
    setBusy(true)
    try {
      const session = await api.createFirstParent(username.trim(), password)
      adoptSession(session)
      navigate('/parent', { replace: true })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-screen">
      <form className="card auth-card" onSubmit={submit}>
        <div className="mascot">🦉</div>
        <h1>Welcome to Aria Learn!</h1>
        <p className="muted">
          Let's create your parent account. This stays on this computer — nothing is sent anywhere.
        </p>
        <label>
          Choose a username
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            autoComplete="username"
            placeholder="e.g. mum"
          />
        </label>
        <label>
          Choose a password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </label>
        <label>
          Type your password again
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
        </label>
        {error && <div className="error">{error}</div>}
        <button className="btn btn--primary" disabled={busy}>
          {busy ? 'Creating your account...' : <><Sparkles size={17} /> Create account</>}
        </button>
        <p className="hint">
          You'll use this to add your children and see how they're doing.
          Keep the password somewhere safe — it can't be recovered.
        </p>
      </form>
    </div>
  )
}

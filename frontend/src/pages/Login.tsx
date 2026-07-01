import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogIn } from 'lucide-react'
import { useAuth } from '../auth'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [usernameOrEmail, setU] = useState('')
  const [password, setP] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const role = await login(usernameOrEmail.trim(), password)
      navigate(role === 'PARENT' ? '/parent' : '/student')
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
        <h1>Hi, I am Aria!</h1>
        <p className="muted">Your friendly learning tutor. Please sign in.</p>
        <label>
          Username or email
          <input value={usernameOrEmail} onChange={(e) => setU(e.target.value)} autoFocus />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setP(e.target.value)} />
        </label>
        {error && <div className="error">{error}</div>}
        <button className="btn btn--primary" disabled={busy}>
          {busy ? 'Signing in...' : <><LogIn size={17} /> Sign in</>}
        </button>
        <p className="hint">Parent demo: parent@demo.com / parent123</p>
      </form>
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AiUsage, api, PromptSummary, PromptTestResult, PromptVersion } from '../api'
import { useAuth } from '../auth'

function extractVars(...texts: string[]): string[] {
  const set = new Set<string>()
  const re = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g
  for (const t of texts) {
    let m
    while ((m = re.exec(t)) !== null) set.add(m[1])
  }
  return [...set]
}

export default function PromptAdminPage() {
  const { logout } = useAuth()
  const [prompts, setPrompts] = useState<PromptSummary[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [history, setHistory] = useState<PromptVersion[]>([])
  const [system, setSystem] = useState('')
  const [user, setUser] = useState('')
  const [vars, setVars] = useState<Record<string, string>>({})
  const [result, setResult] = useState<PromptTestResult | null>(null)
  const [usage, setUsage] = useState<AiUsage | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const active = history.find((v) => v.active)

  useEffect(() => {
    api.adminPrompts().then(setPrompts).catch((e) => setError((e as Error).message))
    api.aiUsage(14).then(setUsage).catch(() => {})
  }, [])

  const select = async (name: string) => {
    setSelected(name); setResult(null); setError(null)
    const h = await api.promptHistory(name)
    setHistory(h)
    const act = h.find((v) => v.active) ?? h[0]
    setSystem(act.systemPrompt); setUser(act.userPromptTemplate); setVars({})
  }

  const variables = useMemo(() => extractVars(system, user), [system, user])

  const publish = async () => {
    if (!selected || !active) return
    setBusy('publish'); setError(null)
    try {
      await api.publishPrompt(selected, {
        systemPrompt: system, userPromptTemplate: user,
        modelTier: active.modelTier, temperature: active.temperature,
        maxTokens: active.maxTokens, jsonMode: active.jsonMode,
      })
      await select(selected)
      await api.adminPrompts().then(setPrompts)
    } catch (e) { setError((e as Error).message) } finally { setBusy(null) }
  }

  const rollback = async (version: number) => {
    if (!selected || !window.confirm(`Roll back to version ${version}?`)) return
    setBusy('rollback')
    try { await api.rollbackPrompt(selected, version); await select(selected); await api.adminPrompts().then(setPrompts) }
    catch (e) { setError((e as Error).message) } finally { setBusy(null) }
  }

  const runTest = async () => {
    if (!selected) return
    setBusy('test'); setResult(null); setError(null)
    try { setResult(await api.testPrompt(selected, vars)) }
    catch (e) { setError((e as Error).message) } finally { setBusy(null) }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">🦉 Aria <span className="muted">· Prompts</span></div>
        <div className="topbar-right">
          <Link className="btn btn--ghost" to="/parent">← Dashboard</Link>
          <button className="btn btn--ghost" onClick={logout}>Sign out</button>
        </div>
      </header>

      <main className="container">
        <h2>AI Prompts</h2>
        <p className="muted">Edit how Aria teaches. Changes publish a new version; you can roll back anytime.</p>
        {error && <div className="error">{error}</div>}

        {usage && (
          <div className="card">
            <h3>AI usage (last 14 days)</h3>
            <div className="report-stats">
              <span><strong>{usage.totalCalls}</strong> calls</span>
              <span><strong>{usage.totalTokens.toLocaleString()}</strong> tokens</span>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={usage.byDay.map((d) => ({ day: d.date.slice(5), tokens: d.tokens }))} margin={{ left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="tokens" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="prompt-layout">
          <aside className="card prompt-list">
            {prompts.map((p) => (
              <button key={p.name} className={`prompt-item ${selected === p.name ? 'prompt-item--sel' : ''}`} onClick={() => select(p.name)}>
                <span className="prompt-name">{p.name}</span>
                <span className="muted">v{p.activeVersion} · {p.modelTier}</span>
              </button>
            ))}
          </aside>

          <section className="prompt-editor">
            {!selected && <div className="card"><p className="muted">Select a prompt to edit.</p></div>}
            {selected && (
              <>
                <div className="card">
                  <h3>{selected} <span className="muted">· active v{active?.version}</span></h3>
                  <label>System prompt
                    <textarea rows={5} value={system} onChange={(e) => setSystem(e.target.value)} />
                  </label>
                  <label>User prompt template
                    <textarea rows={12} value={user} onChange={(e) => setUser(e.target.value)} />
                  </label>
                  {variables.length > 0 && (
                    <div className="var-cheat">Variables: {variables.map((v) => <code key={v}>{`{{${v}}}`}</code>)}</div>
                  )}
                  <button className="btn btn--primary" disabled={busy === 'publish'} onClick={publish}>
                    {busy === 'publish' ? 'Publishing...' : 'Publish new version'}
                  </button>
                </div>

                <div className="card">
                  <h3>Test runner</h3>
                  <p className="muted">Run the active prompt against the local model.</p>
                  {variables.map((v) => (
                    <label key={v}>{v}
                      <input value={vars[v] ?? ''} onChange={(e) => setVars((s) => ({ ...s, [v]: e.target.value }))} />
                    </label>
                  ))}
                  <button className="btn btn--accent" disabled={busy === 'test'} onClick={runTest}>
                    {busy === 'test' ? 'Running...' : '▶ Run test'}
                  </button>
                  {result && (
                    <div className="test-output">
                      <div className="muted">{result.model} · {result.promptTokens + result.completionTokens} tokens · {result.latencyMs}ms</div>
                      <pre>{result.output}</pre>
                    </div>
                  )}
                </div>

                <div className="card">
                  <h3>Version history</h3>
                  <ul className="version-list">
                    {history.map((v) => (
                      <li key={v.id} className="version-row">
                        <span>v{v.version} {v.active && <span className="cur-badge" style={{ background: '#dcfce7', color: '#166534' }}>active</span>}</span>
                        <span className="muted">{new Date(v.createdAt).toLocaleDateString()}</span>
                        {!v.active && <button className="cur-btn" disabled={busy === 'rollback'} onClick={() => rollback(v.version)}>↺ Roll back</button>}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}

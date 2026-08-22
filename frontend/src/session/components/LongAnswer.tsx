/**
 * A written response.
 *
 * Nothing here is marked right or wrong. Aria reads what the child wrote, accepts it,
 * and then shows the part worth noticing — because a red cross on an interpretation is
 * the fastest way to teach a child to stop writing one.
 */
export default function LongAnswer({ value, disabled, onChange, onSend, onStuck }: {
  value: string
  disabled: boolean
  onChange: (v: string) => void
  onSend: () => void
  onStuck: () => void
}) {
  return (
    <>
      <div className="sx-panehead"><h3>Your answer</h3></div>
      <textarea className="sx-longtext" value={value} disabled={disabled}
                placeholder="Write what you think…"
                onChange={(e) => onChange(e.target.value)} />
      <div className="sx-actions">
        <button className="sx-btn sx-btn--check" disabled={disabled || !value.trim()} onClick={onSend}>
          Send to Aria
        </button>
        <button className="sx-btn sx-btn--ghost" onClick={onStuck}>I&apos;m stuck</button>
      </div>
    </>
  )
}

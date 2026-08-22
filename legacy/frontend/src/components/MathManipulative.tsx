import { PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from 'react'
import { Minus, Plus, RotateCcw, Sparkles } from 'lucide-react'
import { celebrateBig } from '../lib/celebrate'
import { MathProblem } from '../lib/mathProblem'

const SHAPE_COLORS = ['#6366f1', '#f59e0b', '#16a34a', '#ec4899', '#0ea5e9', '#8b5cf6', '#fb7185', '#14b8a6']

interface Derived {
  n: number      // total shapes
  g: number      // number of groups
  t: number      // target per group
  r: number      // remainder left in the pool (division only)
  goal: string
  answer: string
}

/** Turn an (op, a, b) problem into "distribute N shapes into G groups, T per group". */
function derive(op: '×' | '÷', a: number, b: number): Derived {
  if (op === '÷') {
    const g = b, t = Math.floor(a / b), n = a, r = a - g * t
    return { n, g, t, r, goal: `Share ${a} into ${b} equal groups`, answer: `${a} ÷ ${b} = ${t}${r > 0 ? ` remainder ${r}` : ''}` }
  }
  return { n: a * b, g: a, t: b, r: 0, goal: `Make ${a} groups of ${b}`, answer: `${a} × ${b} = ${a * b}` }
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/**
 * Draggable shapes kids group to model × and ÷. `editable` adds an operation
 * toggle and number steppers so it doubles as a free explorer on lesson pages.
 */
export default function MathManipulative({ op: op0, a: a0, b: b0, editable }: MathProblem & { editable?: boolean }) {
  const [op, setOp] = useState<'×' | '÷'>(op0)
  const [a, setA] = useState(a0)
  const [b, setB] = useState(b0)
  const { n, g, t, r, goal, answer } = derive(op, a, b)

  // place[i] = group index the shape is in, or -1 for the pool.
  const [place, setPlace] = useState<number[]>(() => Array(n).fill(-1))
  const [drag, setDrag] = useState<{ id: number; x: number; y: number } | null>(null)
  const solvedRef = useRef(false)

  // Reset the board whenever the problem changes.
  useEffect(() => { setPlace(Array(n).fill(-1)); solvedRef.current = false }, [op, a, b, n])

  const counts = Array(g).fill(0)
  place.forEach((grp) => { if (grp >= 0 && grp < g) counts[grp]++ })
  const solved = n > 0 && counts.every((c) => c === t)

  useEffect(() => {
    if (solved && !solvedRef.current) { solvedRef.current = true; celebrateBig() }
    if (!solved) solvedRef.current = false
  }, [solved])

  const assign = (id: number, zone: number) =>
    setPlace((p) => { const next = [...p]; next[id] = zone; return next })

  const startDrag = (id: number, e: ReactPointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    setDrag({ id, x: e.clientX, y: e.clientY })
  }
  const moveDrag = (e: ReactPointerEvent) => { if (drag) setDrag({ id: drag.id, x: e.clientX, y: e.clientY }) }
  const endDrag = (e: ReactPointerEvent) => {
    if (!drag) return
    // The ghost has pointer-events:none, so this finds the real zone underneath.
    const zoneEl = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest('[data-zone]') as HTMLElement | null
    if (zoneEl) {
      const z = zoneEl.dataset.zone!
      assign(drag.id, z === 'pool' ? -1 : Number(z))
    }
    setDrag(null)
  }

  const shareEvenly = () => {
    const next = Array(n).fill(-1)
    let idx = 0
    for (let grp = 0; grp < g; grp++) for (let k = 0; k < t; k++) next[idx++] = grp
    setPlace(next)
  }
  const reset = () => setPlace(Array(n).fill(-1))

  const shapesIn = (zone: number) => place.map((grp, i) => (grp === zone ? i : -1)).filter((i) => i >= 0)

  const shapeProps = (id: number) => ({
    className: 'manip-shape',
    style: { background: SHAPE_COLORS[id % SHAPE_COLORS.length], opacity: drag?.id === id ? 0.3 : 1 },
    onPointerDown: (e: ReactPointerEvent) => startDrag(id, e),
    onPointerMove: moveDrag,
    onPointerUp: endDrag,
  })

  // Steppers keep the shape count sensible for either operation.
  const setAClamped = (v: number) => setA(op === '÷' ? clamp(v, 2, 24) : clamp(v, 1, 8))
  const setBClamped = (v: number) => setB(op === '÷' ? clamp(v, 2, 8) : clamp(v, 1, 8))
  const switchOp = (next: '×' | '÷') => {
    setOp(next)
    if (next === '÷') { setA((x) => clamp(x, 2, 24)); setB((x) => clamp(x, 2, 8)) }
    else { setA((x) => clamp(x, 1, 8)); setB((x) => clamp(x, 1, 8)) }
  }

  const poolIds = shapesIn(-1)

  return (
    <div className={`manip ${solved ? 'manip--solved' : ''}`}>
      {editable && (
        <div className="manip-editor">
          <div className="manip-op">
            <button className={`chip ${op === '÷' ? 'chip--on' : ''}`} onClick={() => switchOp('÷')}>➗ Divide</button>
            <button className={`chip ${op === '×' ? 'chip--on' : ''}`} onClick={() => switchOp('×')}>✖️ Multiply</button>
          </div>
          <div className="manip-nums">
            <Stepper label={op === '÷' ? 'Total' : 'Groups'} value={a} onDec={() => setAClamped(a - 1)} onInc={() => setAClamped(a + 1)} />
            <span className="manip-op-sign">{op}</span>
            <Stepper label={op === '÷' ? 'Groups' : 'Each'} value={b} onDec={() => setBClamped(b - 1)} onInc={() => setBClamped(b + 1)} />
          </div>
        </div>
      )}

      <div className="manip-goal">🎯 {goal}</div>

      <div className="manip-pool" data-zone="pool">
        {poolIds.map((id) => <span key={id} {...shapeProps(id)} />)}
        {poolIds.length === 0 && <span className="manip-hint">All shared out! 👇</span>}
      </div>

      <div className="manip-groups">
        {Array.from({ length: g }).map((_, grp) => (
          <div key={grp} className={`manip-group ${counts[grp] === t ? 'manip-group--full' : ''}`} data-zone={grp}>
            <div className="manip-group-shapes">
              {shapesIn(grp).map((id) => <span key={id} {...shapeProps(id)} />)}
            </div>
            <div className="manip-group-count">{counts[grp]}</div>
          </div>
        ))}
      </div>

      <div className="manip-controls">
        <button className="chip" onClick={shareEvenly}><Sparkles size={14} /> Share evenly</button>
        <button className="chip" onClick={reset}><RotateCcw size={14} /> Reset</button>
        {op === '÷' && r > 0 && !solved && <span className="manip-note">Tip: {r} will be left over</span>}
      </div>

      {solved && <div className="manip-result">🎉 {answer}</div>}

      {/* Floating ghost that follows the pointer while dragging. */}
      {drag && (
        <span className="manip-ghost"
              style={{ left: drag.x, top: drag.y, background: SHAPE_COLORS[drag.id % SHAPE_COLORS.length] }} />
      )}
    </div>
  )
}

function Stepper({ label, value, onDec, onInc }: { label: string; value: number; onDec: () => void; onInc: () => void }) {
  return (
    <div className="manip-stepper">
      <span className="manip-stepper-label">{label}</span>
      <div className="manip-stepper-row">
        <button className="manip-step-btn" onClick={onDec} aria-label={`decrease ${label}`}><Minus size={14} /></button>
        <span className="manip-stepper-value">{value}</span>
        <button className="manip-step-btn" onClick={onInc} aria-label={`increase ${label}`}><Plus size={14} /></button>
      </div>
    </div>
  )
}

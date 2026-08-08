import { useEffect, useState } from 'react'
import { Visual } from '../api'
import { visualStepCount } from '../lib/lessonBeats'

const COLORS = ['#6366f1', '#f59e0b', '#16a34a', '#ec4899', '#0ea5e9', '#8b5cf6']

/** True when the child (or their OS) has asked for less animation. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!mq) return
    const on = () => setReduced(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return !!reduced
}

/**
 * Reveals a visual one piece at a time so the child watches the idea being built,
 * instead of being shown a finished picture. Aims for a ~3.5s build regardless of
 * how many pieces there are, clamped so tiny visuals aren't sluggish and big ones
 * aren't a slideshow.
 */
function useBuildUp(total: number, playing: boolean, instant: boolean) {
  const [shown, setShown] = useState(0)

  useEffect(() => {
    if (instant || !playing) { setShown(total); return }
    setShown(0)
    if (total <= 0) return
    const step = Math.min(400, Math.max(70, Math.round(3500 / total)))
    let n = 0
    const id = setInterval(() => {
      n += 1
      setShown(n)
      if (n >= total) clearInterval(id)
    }, step)
    return () => clearInterval(id)
  }, [total, playing, instant])

  return shown
}

function Groups({ v, shown }: { v: Visual; shown: number }) {
  const groups = Math.min(v.groups ?? v.rows ?? 0, 12)
  const per = Math.min(v.itemsPerGroup ?? v.cols ?? 0, 20)
  const emoji = v.emoji || '🔵'
  let idx = 0
  return (
    <div className="vis-groups">
      {Array.from({ length: groups }).map((_, g) => (
        <div className="vis-group av-group" key={g}>
          {Array.from({ length: per }).map((_, i) => {
            const mine = idx++
            return (
              <span key={i} className={`vis-emoji av-item ${mine < shown ? 'av-item--in' : ''}`}>
                {emoji}
              </span>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function ArrayDots({ v, shown }: { v: Visual; shown: number }) {
  const rows = Math.min(v.rows ?? v.groups ?? 0, 15)
  const cols = Math.min(v.cols ?? v.itemsPerGroup ?? 0, 15)
  const r = 9, gap = 7, pad = 10
  const w = pad * 2 + cols * (r * 2) + Math.max(0, cols - 1) * gap
  const h = pad * 2 + rows * (r * 2) + Math.max(0, rows - 1) * gap
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="vis-svg" style={{ maxWidth: w }}>
      {Array.from({ length: rows }).flatMap((_, ri) =>
        Array.from({ length: cols }).map((_, ci) => {
          const mine = ri * cols + ci
          return (
            <circle
              key={`${ri}-${ci}`}
              className={`av-dot ${mine < shown ? 'av-dot--in' : ''}`}
              cx={pad + r + ci * (r * 2 + gap)}
              cy={pad + r + ri * (r * 2 + gap)}
              r={r}
              fill={COLORS[ri % COLORS.length]}
            />
          )
        }))}
    </svg>
  )
}

/** The token actually hops along the line, which is the whole point of a number line. */
function NumberLine({ v, shown }: { v: Visual; shown: number }) {
  const max = Math.max(1, v.max ?? 10)
  const jumps = (v.jumps ?? []).filter((n) => n >= 0 && n <= max)
  const W = 420, pad = 26, y = 46
  const x = (n: number) => pad + (n / max) * (W - 2 * pad)
  const ticks = Array.from({ length: max + 1 }, (_, i) => i)
  const labelStep = max > 20 ? Math.ceil(max / 10) : 1
  const at = jumps.length ? jumps[Math.max(0, Math.min(shown, jumps.length) - 1)] : 0

  return (
    <svg viewBox={`0 0 ${W} 78`} className="vis-svg">
      <line x1={x(0)} y1={y} x2={x(max)} y2={y} stroke="#94a3b8" strokeWidth={2} />
      {ticks.map((n) => (
        <g key={n}>
          <line x1={x(n)} y1={y - 5} x2={x(n)} y2={y + 5} stroke="#94a3b8" strokeWidth={1.5} />
          {(n % labelStep === 0 || n === max) && (
            <text x={x(n)} y={y + 20} fontSize={10} textAnchor="middle" fill="#64748b">{n}</text>
          )}
        </g>
      ))}
      {jumps.map((n, i) => {
        if (i === 0) return null
        const x1 = x(jumps[i - 1]), x2 = x(n), mid = (x1 + x2) / 2
        return (
          <path
            key={i}
            className={`av-arc ${i < shown ? 'av-arc--in' : ''}`}
            d={`M ${x1} ${y} Q ${mid} ${y - 26} ${x2} ${y}`}
            fill="none" stroke="#f59e0b" strokeWidth={2.5}
          />
        )
      })}
      {jumps.map((n, i) => (
        <circle key={`d${i}`} className={`av-stop ${i < shown ? 'av-stop--in' : ''}`}
                cx={x(n)} cy={y} r={5} fill="#4f46e5" />
      ))}
      {jumps.length > 0 && (
        <g className="av-hopper" style={{ transform: `translateX(${x(at) - x(0)}px)` }}>
          <circle cx={x(0)} cy={y - 14} r={8} fill="#ec4899" />
          <text x={x(0)} y={y - 10} fontSize={9} textAnchor="middle" fill="#fff" fontWeight="700">{at}</text>
        </g>
      )}
    </svg>
  )
}

function FractionBar({ v, shown }: { v: Visual; shown: number }) {
  const parts = Math.max(1, Math.min(v.parts ?? 1, 16))
  const shaded = Math.max(0, Math.min(v.shaded ?? 0, parts))
  const W = 340, H = 52, segW = W / parts
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="vis-svg">
      {Array.from({ length: parts }).map((_, i) => {
        const fills = i < shaded && i < shown
        return (
          <rect key={i} className={`av-seg ${fills ? 'av-seg--in' : ''}`}
                x={i * segW} y={2} width={segW} height={H - 4}
                fill={fills ? '#6366f1' : '#eef2ff'} stroke="#4f46e5" strokeWidth={1.5} />
        )
      })}
    </svg>
  )
}

function ShapeFig({ v, shown }: { v: Visual; shown: number }) {
  const fill = '#a5b4fc', stroke = '#4f46e5'
  const shape = (v.shape ?? '').toLowerCase()
  const cls = `av-shape ${shown > 0 ? 'av-shape--in' : ''}`
  return (
    <svg viewBox="0 0 140 130" className="vis-svg" style={{ maxWidth: 160 }}>
      {shape === 'circle' && <circle className={cls} cx={70} cy={60} r={50} fill={fill} stroke={stroke} strokeWidth={3} />}
      {shape === 'triangle' && <polygon className={cls} points="70,12 122,108 18,108" fill={fill} stroke={stroke} strokeWidth={3} />}
      {shape === 'square' && <rect className={cls} x={22} y={12} width={96} height={96} fill={fill} stroke={stroke} strokeWidth={3} />}
      {(shape === 'rectangle' || !['circle', 'triangle', 'square'].includes(shape)) &&
        <rect className={cls} x={12} y={28} width={116} height={66} fill={fill} stroke={stroke} strokeWidth={3} />}
    </svg>
  )
}

/** Ten-frames are how "making ten" is taught — the empty cells are the point. */
function TenFrame({ v, shown }: { v: Visual; shown: number }) {
  const a = Math.max(0, Math.min(v.filled ?? 0, 20))
  const b = Math.max(0, Math.min(v.ones ?? 0, 20 - a))
  const frames = a + b > 10 ? 2 : 1
  const S = 26, pad = 6, fw = S * 5
  const W = frames * fw + (frames - 1) * 16 + pad * 2
  const H = S * 2 + pad * 2

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="vis-svg" style={{ maxWidth: W * 1.6 }}>
      {Array.from({ length: frames * 10 }).map((_, i) => {
        const f = Math.floor(i / 10), w = i % 10
        const x = pad + f * (fw + 16) + (w % 5) * S
        const y = pad + Math.floor(w / 5) * S
        const on = i < shown
        const fill = i < a ? '#6366f1' : '#f59e0b'
        return (
          <g key={i}>
            <rect x={x} y={y} width={S} height={S} fill="#fff" stroke="#94a3b8" strokeWidth={1.5} />
            {i < a + b && (
              <circle className={`av-dot ${on ? 'av-dot--in' : ''}`}
                      cx={x + S / 2} cy={y + S / 2} r={S / 2 - 5} fill={fill} />
            )}
          </g>
        )
      })}
    </svg>
  )
}

/** Place value made physical: rods of ten and single units. */
function BaseTen({ v, shown }: { v: Visual; shown: number }) {
  const h = Math.max(0, Math.min(v.hundreds ?? 0, 9))
  const t = Math.max(0, Math.min(v.tens ?? 0, 9))
  const o = Math.max(0, Math.min(v.ones ?? 0, 9))
  const U = 11, gap = 6
  const flatW = U * 10
  const W = h * (flatW + gap) + t * (U + gap) + Math.ceil(o / 5) * (U + gap) + 30
  const H = U * 10 + 16
  let idx = 0
  let x = 8

  const nodes: JSX.Element[] = []
  for (let i = 0; i < h; i++, idx++) {
    const mine = idx, gx = x
    nodes.push(
      <rect key={`h${i}`} className={`av-dot ${mine < shown ? 'av-dot--in' : ''}`}
            x={gx} y={8} width={flatW} height={U * 10} fill="#c7d2fe" stroke="#4f46e5" strokeWidth={2} />)
    x += flatW + gap
  }
  for (let i = 0; i < t; i++, idx++) {
    const mine = idx, gx = x
    nodes.push(
      <g key={`t${i}`} className={`av-dot ${mine < shown ? 'av-dot--in' : ''}`}>
        <rect x={gx} y={8} width={U} height={U * 10} fill="#6366f1" stroke="#4338ca" strokeWidth={1.5} />
        {Array.from({ length: 9 }).map((_, k) => (
          <line key={k} x1={gx} y1={8 + (k + 1) * U} x2={gx + U} y2={8 + (k + 1) * U}
                stroke="#4338ca" strokeWidth={0.8} />
        ))}
      </g>)
    x += U + gap
  }
  for (let i = 0; i < o; i++, idx++) {
    const mine = idx
    const col = Math.floor(i / 5), row = i % 5
    nodes.push(
      <rect key={`o${i}`} className={`av-dot ${mine < shown ? 'av-dot--in' : ''}`}
            x={x + col * (U + gap)} y={8 + row * (U + 3)} width={U} height={U}
            fill="#f59e0b" stroke="#b45309" strokeWidth={1.2} />)
  }

  return <svg viewBox={`0 0 ${Math.max(W, 60)} ${H}`} className="vis-svg" style={{ maxWidth: 320 }}>{nodes}</svg>
}

/** Part-part-whole, the shape fact families are taught in. */
function NumberBond({ v, shown }: { v: Visual; shown: number }) {
  const whole = v.whole ?? 0, a = v.partA ?? 0, b = v.partB ?? 0
  const W = 220, H = 160
  const node = (cx: number, cy: number, r: number, n: number, fill: string, on: boolean, key: string) => (
    <g key={key} className={`av-dot ${on ? 'av-dot--in' : ''}`}>
      <circle cx={cx} cy={cy} r={r} fill={fill} stroke="#4338ca" strokeWidth={2.5} />
      <text x={cx} y={cy + 7} fontSize={21} fontWeight={800} textAnchor="middle" fill="#fff">{n}</text>
    </g>
  )
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="vis-svg" style={{ maxWidth: 240 }}>
      <line x1={110} y1={60} x2={58} y2={104} stroke="#a5b4fc" strokeWidth={3} />
      <line x1={110} y1={60} x2={162} y2={104} stroke="#a5b4fc" strokeWidth={3} />
      {node(110, 34, 28, whole, '#4f46e5', shown > 0, 'w')}
      {node(58, 122, 25, a, '#6366f1', shown > 1, 'a')}
      {node(162, 122, 25, b, '#8b5cf6', shown > 2, 'b')}
    </svg>
  )
}

/** Two bars plus the symbol — comparison is easier to see than to read. */
function Comparison({ v, shown }: { v: Visual; shown: number }) {
  const a = v.left ?? 0, b = v.right ?? 0
  const max = Math.max(a, b, 1)
  const W = 260, H = 150, barW = 62, base = 118
  const bar = (x: number, n: number, fill: string, on: boolean) => {
    const h = Math.max(6, (n / max) * 96)
    return (
      <g className={`av-grow ${on ? 'av-grow--in' : ''}`} style={{ transformOrigin: `${x + barW / 2}px ${base}px` }}>
        <rect x={x} y={base - h} width={barW} height={h} rx={6} fill={fill} />
        <text x={x + barW / 2} y={base + 22} fontSize={22} fontWeight={800} textAnchor="middle" fill="#232135">{n}</text>
      </g>
    )
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="vis-svg" style={{ maxWidth: 280 }}>
      {bar(18, a, '#6366f1', shown > 0)}
      {bar(180, b, '#ec4899', shown > 0)}
      <text x={130} y={100} fontSize={46} fontWeight={800} textAnchor="middle" fill="#f59e0b"
            className={`av-dot ${shown > 1 ? 'av-dot--in' : ''}`}>
        {a > b ? '>' : a < b ? '<' : '='}
      </text>
    </svg>
  )
}

/** An analogue clock whose hands sweep round to the time being described. */
function Clock({ v, shown }: { v: Visual; shown: number }) {
  const hour = ((v.hour ?? 12) % 12 + 12) % 12
  const minute = Math.max(0, Math.min(v.minute ?? 0, 59))
  const minAngle = minute * 6
  const hrAngle = hour * 30 + minute * 0.5
  const C = 70, R = 58
  return (
    <svg viewBox="0 0 140 140" className="vis-svg" style={{ maxWidth: 190 }}>
      <circle cx={C} cy={C} r={R} fill="#fff" stroke="#4f46e5" strokeWidth={4} />
      {Array.from({ length: 12 }).map((_, i) => {
        const ang = (i * 30 - 90) * (Math.PI / 180)
        const r1 = R - 9, r2 = R - 3
        return <line key={i} x1={C + r1 * Math.cos(ang)} y1={C + r1 * Math.sin(ang)}
                     x2={C + r2 * Math.cos(ang)} y2={C + r2 * Math.sin(ang)}
                     stroke="#94a3b8" strokeWidth={i % 3 === 0 ? 3 : 1.5} />
      })}
      {[[12, 0, -40], [3, 40, 5], [6, 0, 47], [9, -40, 5]].map(([n, dx, dy]) => (
        <text key={n} x={C + dx} y={C + dy} fontSize={14} fontWeight={700} textAnchor="middle" fill="#64748b">{n}</text>
      ))}
      <line className="av-hand" x1={C} y1={C} x2={C} y2={C - 32} stroke="#4f46e5" strokeWidth={6} strokeLinecap="round"
            style={{ transform: `rotate(${shown > 0 ? hrAngle : 0}deg)`, transformOrigin: `${C}px ${C}px` }} />
      <line className="av-hand" x1={C} y1={C} x2={C} y2={C - 46} stroke="#ec4899" strokeWidth={4} strokeLinecap="round"
            style={{ transform: `rotate(${shown > 1 ? minAngle : 0}deg)`, transformOrigin: `${C}px ${C}px` }} />
      <circle cx={C} cy={C} r={5} fill="#232135" />
    </svg>
  )
}

/** Tallies in the conventional gate-of-five, because that grouping is the lesson. */
function Tally({ v, shown }: { v: Visual; shown: number }) {
  const n = Math.max(0, Math.min(v.count ?? 0, 30))
  const groups = Math.ceil(n / 5)
  const GW = 46, H = 54
  return (
    <svg viewBox={`0 0 ${Math.max(GW * groups + 10, 40)} ${H}`} className="vis-svg" style={{ maxWidth: 340 }}>
      {Array.from({ length: n }).map((_, i) => {
        const g = Math.floor(i / 5), k = i % 5
        const x = 8 + g * GW + k * 7
        const on = i < shown
        return k === 4
          ? <line key={i} className={`av-mark ${on ? 'av-mark--in' : ''}`}
                  x1={8 + g * GW - 4} y1={44} x2={8 + g * GW + 30} y2={10}
                  stroke="#ec4899" strokeWidth={3.5} strokeLinecap="round" />
          : <line key={i} className={`av-mark ${on ? 'av-mark--in' : ''}`}
                  x1={x} y1={10} x2={x} y2={44} stroke="#4f46e5" strokeWidth={3.5} strokeLinecap="round" />
      })}
    </svg>
  )
}

/** A number sentence that assembles term by term, so the child reads it left to right. */
function Equation({ v, shown }: { v: Visual; shown: number }) {
  const terms = v.terms ?? []
  return (
    <div className="av-eq">
      {terms.map((t, i) => (
        <span key={i} className={`av-eq__term ${i < shown ? 'av-eq__term--in' : ''} ${/[+\-−×÷=]/.test(t) ? 'av-eq__op' : ''}`}>
          {t}
        </span>
      ))}
    </div>
  )
}

/** Word tiles for language lessons, landing one at a time so a phrase reads as parts. */
function WordCards({ v, shown }: { v: Visual; shown: number }) {
  const words = v.terms ?? []
  return (
    <div className="av-words">
      {words.map((w, i) => (
        <span key={i} className={`av-word ${i < shown ? 'av-word--in' : ''}`}>{w}</span>
      ))}
    </div>
  )
}

/**
 * Same five visual types the static MathVisual renders, but assembled piece by piece
 * while Aria narrates the beat they belong to.
 */
export default function AnimatedVisual({ visual, playing }: { visual: Visual; playing: boolean }) {
  const reduced = usePrefersReducedMotion()
  const total = visualStepCount(visual)
  const shown = useBuildUp(total, playing, reduced)

  const t = (visual.type ?? '').toLowerCase()
  let body = null
  if (t === 'groups') body = <Groups v={visual} shown={shown} />
  else if (t === 'array') body = <ArrayDots v={visual} shown={shown} />
  else if (t === 'numberline') body = <NumberLine v={visual} shown={shown} />
  else if (t === 'fractionbar') body = <FractionBar v={visual} shown={shown} />
  else if (t === 'shape') body = <ShapeFig v={visual} shown={shown} />
  else if (t === 'tenframe') body = <TenFrame v={visual} shown={shown} />
  else if (t === 'baseten') body = <BaseTen v={visual} shown={shown} />
  else if (t === 'numberbond') body = <NumberBond v={visual} shown={shown} />
  else if (t === 'comparison') body = <Comparison v={visual} shown={shown} />
  else if (t === 'clock') body = <Clock v={visual} shown={shown} />
  else if (t === 'tally') body = <Tally v={visual} shown={shown} />
  else if (t === 'equation') body = <Equation v={visual} shown={shown} />
  else if (t === 'wordcards') body = <WordCards v={visual} shown={shown} />

  if (!body) return null
  return (
    <figure className="vis av-vis">
      {body}
      {visual.caption && <figcaption className="vis-cap av-cap">{visual.caption}</figcaption>}
    </figure>
  )
}

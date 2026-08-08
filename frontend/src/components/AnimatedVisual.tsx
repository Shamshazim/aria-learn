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

  if (!body) return null
  return <figure className="vis av-vis">{body}</figure>
}

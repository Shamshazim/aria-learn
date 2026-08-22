import { Visual } from '../api'

const COLORS = ['#6366f1', '#f59e0b', '#16a34a', '#ec4899', '#0ea5e9', '#8b5cf6']

function Groups({ v }: { v: Visual }) {
  const groups = Math.min(v.groups ?? v.rows ?? 0, 12)
  const per = Math.min(v.itemsPerGroup ?? v.cols ?? 0, 20)
  const emoji = v.emoji || '🔵'
  return (
    <div className="vis-groups">
      {Array.from({ length: groups }).map((_, g) => (
        <div className="vis-group" key={g}>
          {Array.from({ length: per }).map((_, i) => <span key={i} className="vis-emoji">{emoji}</span>)}
        </div>
      ))}
    </div>
  )
}

function ArrayDots({ v }: { v: Visual }) {
  const rows = Math.min(v.rows ?? v.groups ?? 0, 15)
  const cols = Math.min(v.cols ?? v.itemsPerGroup ?? 0, 15)
  const r = 9, gap = 7, pad = 10
  const w = pad * 2 + cols * (r * 2) + Math.max(0, cols - 1) * gap
  const h = pad * 2 + rows * (r * 2) + Math.max(0, rows - 1) * gap
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="vis-svg" style={{ maxWidth: w }}>
      {Array.from({ length: rows }).flatMap((_, ri) =>
        Array.from({ length: cols }).map((_, ci) => (
          <circle key={`${ri}-${ci}`} cx={pad + r + ci * (r * 2 + gap)} cy={pad + r + ri * (r * 2 + gap)}
                  r={r} fill={COLORS[ri % COLORS.length]} />
        )))}
    </svg>
  )
}

function NumberLine({ v }: { v: Visual }) {
  const max = Math.max(1, v.max ?? 10)
  const jumps = (v.jumps ?? []).filter((n) => n >= 0 && n <= max)
  const W = 420, pad = 26, y = 46
  const x = (n: number) => pad + (n / max) * (W - 2 * pad)
  const ticks = Array.from({ length: max + 1 }, (_, i) => i)
  const labelStep = max > 20 ? Math.ceil(max / 10) : 1
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
        return <path key={i} d={`M ${x1} ${y} Q ${mid} ${y - 26} ${x2} ${y}`} fill="none" stroke="#f59e0b" strokeWidth={2.5} />
      })}
      {jumps.map((n, i) => <circle key={`d${i}`} cx={x(n)} cy={y} r={5} fill="#4f46e5" />)}
    </svg>
  )
}

function FractionBar({ v }: { v: Visual }) {
  const parts = Math.max(1, Math.min(v.parts ?? 1, 16))
  const shaded = Math.max(0, Math.min(v.shaded ?? 0, parts))
  const W = 340, H = 52, segW = W / parts
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="vis-svg">
      {Array.from({ length: parts }).map((_, i) => (
        <rect key={i} x={i * segW} y={2} width={segW} height={H - 4}
              fill={i < shaded ? '#6366f1' : '#eef2ff'} stroke="#4f46e5" strokeWidth={1.5} />
      ))}
    </svg>
  )
}

function ShapeFig({ v }: { v: Visual }) {
  const fill = '#a5b4fc', stroke = '#4f46e5'
  const shape = (v.shape ?? '').toLowerCase()
  return (
    <svg viewBox="0 0 140 130" className="vis-svg" style={{ maxWidth: 160 }}>
      {shape === 'circle' && <circle cx={70} cy={60} r={50} fill={fill} stroke={stroke} strokeWidth={3} />}
      {shape === 'triangle' && <polygon points="70,12 122,108 18,108" fill={fill} stroke={stroke} strokeWidth={3} />}
      {(shape === 'square') && <rect x={22} y={12} width={96} height={96} fill={fill} stroke={stroke} strokeWidth={3} />}
      {(shape === 'rectangle' || !['circle', 'triangle', 'square'].includes(shape)) &&
        <rect x={12} y={28} width={116} height={66} fill={fill} stroke={stroke} strokeWidth={3} />}
    </svg>
  )
}

export default function MathVisual({ visual }: { visual: Visual }) {
  const t = (visual.type ?? '').toLowerCase()
  let body = null
  if (t === 'groups') body = <Groups v={visual} />
  else if (t === 'array') body = <ArrayDots v={visual} />
  else if (t === 'numberline') body = <NumberLine v={visual} />
  else if (t === 'fractionbar') body = <FractionBar v={visual} />
  else if (t === 'shape') body = <ShapeFig v={visual} />

  if (!body && !visual.caption) return null
  return (
    <figure className="vis">
      {body}
      {visual.caption && <figcaption className="vis-cap">{visual.caption}</figcaption>}
    </figure>
  )
}

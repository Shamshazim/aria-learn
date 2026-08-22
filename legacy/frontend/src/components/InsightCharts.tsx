import {
  Bar, BarChart, Cell, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { ParentCharts } from '../api'

const STATUS_COLOR: Record<string, string> = {
  MASTERED: '#16a34a',
  IN_PROGRESS: '#4f46e5',
  AVAILABLE: '#94a3b8',
  LOCKED: '#cbd5e1',
}

function shortDay(iso: string) {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString(undefined, { weekday: 'short' })
}

export default function InsightCharts({ charts }: { charts: ParentCharts }) {
  const masteryData = charts.masteryByTopic.map((t) => ({
    name: t.topicName.length > 16 ? t.topicName.slice(0, 15) + '…' : t.topicName,
    full: t.topicName,
    total: t.total,
    status: t.status,
  }))
  const activityData = charts.activityByDay.map((a) => ({ day: shortDay(a.date), xp: a.xp }))

  return (
    <div className="grid">
      <section className="card">
        <h3>Mastery by topic</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={masteryData} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={50} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => [`${v}%`, 'Mastery']}
                     labelFormatter={(_, p) => (p && p[0] ? p[0].payload.full : '')} />
            <Bar dataKey="total" radius={[6, 6, 0, 0]}>
              {masteryData.map((d, i) => <Cell key={i} fill={STATUS_COLOR[d.status] ?? '#4f46e5'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="card">
        <h3>Activity (last 7 days)</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={activityData} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip formatter={(v: number) => [`${v} XP`, 'Earned']} />
            <Bar dataKey="xp" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </section>
    </div>
  )
}

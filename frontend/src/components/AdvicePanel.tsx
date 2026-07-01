import { AdaptiveProfile } from '../api'

const REC_ICON: Record<string, string> = {
  MORE_PRACTICE: '🎯',
  REVIEW: '🔁',
  INCREASE_DIFFICULTY: '🚀',
  SCHEDULE_REVIEW: '📅',
}

const PACE_LABEL: Record<string, string> = {
  NEW: 'Just getting started',
  BUILDING: 'Building up 💪',
  STEADY: 'Steady progress 📈',
  FLYING: 'Flying high 🌟',
}

export default function AdvicePanel({ profile, childName }: { profile: AdaptiveProfile; childName?: string }) {
  const hasData = profile.masteredCount + profile.inProgressCount > 0
  return (
    <div className="advice-panel">
      <div className="card card--hero advice-hero">
        <h2>{childName ? `${childName}'s progress` : 'Aria’s advice for you'} 🦉</h2>
        {profile.advice ? <p className="advice-text-hero">{profile.advice}</p>
          : <p>{hasData ? 'Keep going — finish a quiz to get personalized advice!' : 'Start a lesson to begin your journey!'}</p>}
        <div className="profile-stats">
          <div className="stat"><span className="stat-num">{profile.accuracy}%</span><span className="stat-label">accuracy</span></div>
          <div className="stat"><span className="stat-num">{profile.masteredCount}</span><span className="stat-label">mastered</span></div>
          <div className="stat"><span className="stat-num">{profile.inProgressCount}</span><span className="stat-label">in progress</span></div>
          <div className="stat"><span className="stat-num-sm">{PACE_LABEL[profile.pace] ?? profile.pace}</span><span className="stat-label">pace</span></div>
        </div>
      </div>

      {profile.recommendations.length > 0 && (
        <div className="card">
          <h3>What to do next</h3>
          <ul className="rec-list">
            {profile.recommendations.map((r, i) => (
              <li key={i} className="rec-item">
                <span className="rec-icon">{REC_ICON[r.type] ?? '✨'}</span>
                <span>{r.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(profile.strengths.length > 0 || profile.weaknesses.length > 0) && (
        <div className="grid">
          <div className="card">
            <h3>💪 Strengths</h3>
            {profile.strengths.length === 0 ? <p className="muted">None yet — keep going!</p> : (
              <div className="chip-row">
                {profile.strengths.map((s) => <span key={s.topicId} className="chip chip--good">{s.topicName} · {s.score}%</span>)}
              </div>
            )}
          </div>
          <div className="card">
            <h3>🎯 Needs work</h3>
            {profile.weaknesses.length === 0 ? <p className="muted">Nothing flagged — great!</p> : (
              <div className="chip-row">
                {profile.weaknesses.map((w) => <span key={w.topicId} className="chip chip--warn">{w.topicName} · {w.score}%</span>)}
              </div>
            )}
          </div>
        </div>
      )}

      {profile.mistakes.length > 0 && (
        <div className="card">
          <h3>Things to watch for</h3>
          <ul className="mistake-list">
            {profile.mistakes.slice(0, 5).map((m, i) => (
              <li key={i}>⚠️ {m.misconception} <span className="muted">({m.topicName}{m.count > 1 ? ` · ×${m.count}` : ''})</span></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

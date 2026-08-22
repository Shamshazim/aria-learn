import { GamificationSummary } from '../api'

const GOAL_LABEL: Record<string, string> = {
  QUESTIONS: 'questions today',
  ACTIVITIES: 'activities this week',
}

export default function GamePanel({ game }: { game: GamificationSummary }) {
  const pct = game.xpForNextLevel > 0 ? Math.min(100, Math.round((game.xpIntoLevel / game.xpForNextLevel) * 100)) : 0
  return (
    <div className="game-panel">
      <div className="card game-header">
        <div className="level-badge">
          <span className="level-num">{game.level}</span>
          <span className="level-word">LEVEL</span>
        </div>
        <div className="xp-area">
          <div className="xp-top">
            <span className="xp-total">⭐ {game.xpTotal} XP</span>
            <span className="streak-flame">🔥 {game.streak.current}-day streak</span>
          </div>
          <div className="xp-bar"><div className="xp-fill" style={{ width: `${pct}%` }} /></div>
          <div className="xp-sub">{game.xpIntoLevel} / {game.xpForNextLevel} XP to level {game.level + 1}</div>
        </div>
      </div>

      <div className="grid">
        <div className="card">
          <h3>Goals</h3>
          {game.goals.map((g) => {
            const gp = g.target > 0 ? Math.min(100, Math.round((g.progress / g.target) * 100)) : 0
            const done = g.progress >= g.target
            return (
              <div key={g.period} className="goal-row">
                <div className="goal-label">
                  {done ? '✅ ' : ''}{g.progress} / {g.target} {GOAL_LABEL[g.metric] ?? g.metric.toLowerCase()}
                </div>
                <div className="goal-bar"><div className="goal-fill" style={{ width: `${gp}%` }} /></div>
              </div>
            )
          })}
        </div>

        <div className="card">
          <h3>Badges <span className="muted">({game.achievements.filter((a) => a.earned).length}/{game.achievements.length})</span></h3>
          <div className="badge-grid">
            {game.achievements.map((a) => (
              <div key={a.code} className={`badge ${a.earned ? 'badge--earned' : 'badge--locked'}`} title={a.description}>
                <span className="badge-icon">{a.icon}</span>
                <span className="badge-name">{a.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

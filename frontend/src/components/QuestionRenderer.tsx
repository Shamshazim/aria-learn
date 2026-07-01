import { PracticeQuestion } from '../api'

// One renderer that switches on question.type. New question types plug in here,
// so every activity (practice, homework, quiz) reuses the same UI.
interface Props {
  question: PracticeQuestion
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  correctAnswer?: string | null
}

export default function QuestionRenderer({ question, value, onChange, disabled, correctAnswer }: Props) {
  switch (question.type) {
    case 'MULTIPLE_CHOICE':
      return (
        <div className="choices">
          {(question.choices ?? []).map((choice) => {
            const selected = value === choice
            const isAnswer = correctAnswer != null && choice === correctAnswer
            const cls = [
              'choice',
              selected ? 'choice--selected' : '',
              disabled && isAnswer ? 'choice--correct' : '',
              disabled && selected && !isAnswer ? 'choice--wrong' : '',
            ].join(' ')
            return (
              <button
                key={choice}
                type="button"
                className={cls}
                disabled={disabled}
                onClick={() => onChange(choice)}
              >
                {choice}
              </button>
            )
          })}
        </div>
      )
    default:
      // SHORT_ANSWER and other free-text types
      return (
        <input
          className="answer-input"
          type="text"
          placeholder="Type your answer..."
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      )
  }
}

import type { Band, TutorMove } from '@aria/shared';

import { TapNumbers, TextEntry } from '@/features/session/components/AnswerEntry';
import { SpeakButton } from '@/features/session/components/SpeakButton';
import { inputModeFor } from '@/features/session/model/answer-input';
import type { VoiceAvailability } from '@/features/session/model/voice-availability';

type InputProps = Readonly<{
  band: Band;
  move: TutorMove;
  voice: VoiceAvailability;
  onAnswer: (value: string) => void;
  onDrag: () => void;
  onSpeech: () => void;
}>;

/**
 * Every question can be answered out loud, and every question that has a typed or tapped
 * answer offers that too. A child who cannot say "seven" yet can tap it; a child who cannot
 * find the 7 on a keyboard can say it. `expects` picks the typed control, never the move kind.
 */
export function InputSurface(props: InputProps): React.JSX.Element | null {
  const control = typedControl(props);
  if (control === null) return null;
  return (
    <div className="input-surface">
      {control}
      <SpeakButton band={props.band} onSpeech={props.onSpeech} voice={props.voice} />
    </div>
  );
}

function typedControl(props: InputProps): React.JSX.Element | null {
  switch (props.move.expects) {
    case 'none':
      return null;
    case 'choice':
      return <Choices band={props.band} move={props.move} onAnswer={props.onAnswer} />;
    case 'number':
      return props.band === 'early' ? (
        <TapNumbers key={props.move.id} onAnswer={props.onAnswer} />
      ) : (
        <TextEntry inputMode="numeric" onAnswer={props.onAnswer} />
      );
    case 'text':
      return (
        <TextEntry
          inputMode={inputModeFor(props.move)}
          key={props.move.id}
          large={props.band === 'early'}
          onAnswer={props.onAnswer}
        />
      );
    case 'speech':
      // The speak button below is the whole of this control.
      return <></>;
    case 'drag':
      return (
        <button
          onClick={() => {
            props.onDrag();
          }}
          type="button"
        >
          Move the pieces
        </button>
      );
    default:
      return assertNever(props.move.expects);
  }
}

function Choices(props: {
  band: Band;
  move: TutorMove;
  onAnswer: (value: string) => void;
}): React.JSX.Element {
  const options = props.move.display.flatMap((item) =>
    item.type === 'choices' ? item.options : [],
  );
  return (
    <div className={props.band === 'early' ? 'answer-tiles' : 'answer-choices'}>
      {options.map((option, index) => (
        <button
          className={props.band === 'early' ? `answer-tile answer-tile--${String(index % 4)}` : ''}
          key={option.id}
          onClick={() => {
            props.onAnswer(option.id);
          }}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function assertNever(value: never): never {
  throw new Error(`Unhandled input expectation: ${String(value)}`);
}

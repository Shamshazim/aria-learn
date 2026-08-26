import { avatarFace } from '../model/pictures';

import { PictureTile } from './PictureTile';

import type { ChildProfile } from '../api/child-auth.api';

/** Who is using the tablet. Nothing here is typed, and nothing here has to be read. */
export function ProfilePicker(
  props: Readonly<{
    profiles: readonly ChildProfile[];
    onChoose(studentId: string): void;
  }>,
): React.JSX.Element {
  return (
    <section className="child-sign-in__step">
      <h1 className="child-sign-in__title">Who is here?</h1>
      <ul className="picture-grid picture-grid--profiles">
        {props.profiles.map((profile) => (
          <li key={profile.studentId}>
            <PictureTile
              face={avatarFace(profile.avatarKey)}
              name={profile.nickname}
              size="large"
              onPress={() => {
                props.onChoose(profile.studentId);
              }}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

import type { ChildPicture } from '@aria/shared';

import { CHILD_PICTURE_ART } from '@/features/auth/components/child-pictures.data';

/** One picture, at whatever size the screen around it needs (P2H-12). */
export function ChildAvatar({
  picture,
  size = 64,
}: Readonly<{ picture: ChildPicture; size?: number }>): React.JSX.Element {
  const art = CHILD_PICTURE_ART[picture];
  return (
    <span aria-hidden className="child-avatar" style={{ fontSize: `${String(size)}px` }}>
      {art.emoji}
    </span>
  );
}

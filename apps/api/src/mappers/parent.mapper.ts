import type { Parent } from '@/types/parent';

import { unmappableRow } from './row';

/**
 * The database row, exactly as SQL returns it. Snake_case stops here: this shape is not
 * allowed to travel any further up than the mapper (CODE-STANDARDS §3.1).
 */
export type ParentRow = {
  id: string;
  email: string | null;
  supabase_user_id: string | null;
  display_name: string;
  created_at: Date;
};

/** Field by field, never a spread: a new column must not silently become a domain field. */
export function toParent(row: ParentRow): Parent {
  if (!(row.created_at instanceof Date)) {
    throw unmappableRow('parent', 'created_at', row.id);
  }

  return {
    id: row.id,
    email: row.email,
    supabaseUserId: row.supabase_user_id,
    displayName: row.display_name,
    createdAt: row.created_at,
  };
}

import type { PindropStorageAdapter, Comment } from './types';

function getReadIds(key: string): Set<string> {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem(key) ?? '[]'));
  } catch {
    return new Set();
  }
}

function saveReadIds(key: string, ids: Set<string>): void {
  try {
    localStorage.setItem(key, JSON.stringify([...ids]));
  } catch {}
}

/**
 * Wraps a storage adapter so that `unread` state is managed locally in
 * localStorage rather than persisted to the remote store. This means each
 * visitor gets independent per-device unread tracking without needing auth.
 *
 * - load(): fetches from the adapter then computes `unread` from the local journal
 * - save(): updates the local journal, strips `unread`, then delegates to the adapter
 */
export function wrapWithReadJournal(
  adapter: PindropStorageAdapter,
  storageKey: string,
): PindropStorageAdapter {
  const journalKey = `${storageKey}-read-ids`;

  return {
    async load() {
      const comments = (await adapter.load()) as Comment[];
      const readIds = getReadIds(journalKey);
      return comments.map((c) => ({ ...c, unread: !readIds.has(c.id) }));
    },

    async save(comments: Comment[]) {
      const readIds = getReadIds(journalKey);
      for (const c of comments) {
        if (!c.unread) readIds.add(c.id);
      }
      saveReadIds(journalKey, readIds);

      const rows = comments.map(({ unread: _, ...c }) => c);
      await adapter.save(rows as Comment[]);
    },
  };
}

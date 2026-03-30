import type { Comment, Reply } from '../core/types';

export interface MergeResult {
  comments: Comment[];
  added: number;
  merged: number;
}

export function mergeComments(local: Comment[], incoming: Comment[]): MergeResult {
  const localMap = new Map(local.map((c) => [c.id, c]));
  let added = 0;
  let merged = 0;

  for (const inc of incoming) {
    const existing = localMap.get(inc.id);
    if (!existing) {
      localMap.set(inc.id, { ...inc, unread: true });
      added++;
    } else {
      merged++;
      const contentChanged = new Date(inc.updatedAt) > new Date(existing.updatedAt);
      const winner = contentChanged ? inc : existing;

      // Merge replies from both sides
      const mergedReplies = mergeReplies(existing.replies, inc.replies);
      const hasNewReplies = mergedReplies.length > existing.replies.length;

      localMap.set(inc.id, {
        ...winner,
        replies: mergedReplies,
        // Preserve local read state; only re-flag unread if content changed or new replies arrived
        unread: contentChanged || hasNewReplies ? true : existing.unread,
      });
    }
  }

  return {
    comments: [...localMap.values()],
    added,
    merged,
  };
}

function mergeReplies(a: Reply[], b: Reply[]): Reply[] {
  const map = new Map<string, Reply>();

  for (const reply of a) {
    map.set(reply.id, reply);
  }

  for (const reply of b) {
    const existing = map.get(reply.id);
    if (!existing || new Date(reply.updatedAt) > new Date(existing.updatedAt)) {
      map.set(reply.id, reply);
    }
  }

  return [...map.values()].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

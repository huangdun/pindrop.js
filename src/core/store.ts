import type { Comment, Reply, PindropStorageAdapter } from './types';
import type { EventEmitter } from './events';

export class Store {
  private comments: Map<string, Comment> = new Map();
  private storageKey: string | null = null;
  private adapter?: PindropStorageAdapter;

  constructor(private events: EventEmitter) { }

  async enablePersistence(storageKey: string, adapter?: PindropStorageAdapter): Promise<void> {
    this.storageKey = `${storageKey}-comments`;
    this.adapter = adapter;
    await this.load();
  }

  getComments(): Comment[] {
    return [...this.comments.values()].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }

  getComment(id: string): Comment | undefined {
    return this.comments.get(id);
  }

  addComment(comment: Comment): void {
    this.comments.set(comment.id, comment);
    this.events.emit('comment:add', comment);
    this.persist();
  }

  moveAnchor(id: string, anchor: import('./types').Anchor, scope?: import('./types').CommentScope): void {
    const comment = this.comments.get(id);
    if (!comment) return;
    comment.anchor = anchor;
    comment.scope = scope;
    comment.updatedAt = new Date().toISOString();
    this.persist();
  }

  resolveComment(id: string, resolvedBy: string): void {
    const comment = this.comments.get(id);
    if (!comment) return;
    const now = new Date().toISOString();
    comment.resolved = true;
    comment.resolvedBy = resolvedBy;
    comment.resolvedAt = now;
    comment.updatedAt = now;
    this.events.emit('comment:resolve', comment);
    this.persist();
  }

  reopenComment(id: string): void {
    const comment = this.comments.get(id);
    if (!comment) return;
    comment.resolved = false;
    comment.resolvedBy = undefined;
    comment.resolvedAt = undefined;
    comment.updatedAt = new Date().toISOString();
    this.events.emit('comment:reopen', comment);
    this.persist();
  }

  addReply(commentId: string, reply: Reply): void {
    const comment = this.comments.get(commentId);
    if (!comment) return;
    comment.replies.push(reply);
    this.events.emit('reply:add', { comment, reply });
    this.persist();
  }

  editComment(id: string, text: string): void {
    const comment = this.comments.get(id);
    if (!comment) return;
    comment.text = text;
    comment.updatedAt = new Date().toISOString();
    this.persist();
  }

  deleteComment(id: string): void {
    const comment = this.comments.get(id);
    if (!comment) return;
    this.comments.delete(id);
    this.events.emit('comment:delete', comment);
    this.persist();
  }

  editReply(commentId: string, replyId: string, text: string): void {
    const comment = this.comments.get(commentId);
    if (!comment) return;
    const reply = comment.replies.find((r) => r.id === replyId);
    if (!reply) return;
    reply.text = text;
    reply.updatedAt = new Date().toISOString();
    comment.updatedAt = reply.updatedAt;
    this.persist();
  }

  deleteReply(commentId: string, replyId: string): void {
    const comment = this.comments.get(commentId);
    if (!comment) return;
    comment.replies = comment.replies.filter((r) => r.id !== replyId);
    comment.updatedAt = new Date().toISOString();
    this.persist();
  }

  markRead(id: string): void {
    const comment = this.comments.get(id);
    if (!comment || !comment.unread) return;
    comment.unread = false;
    this.events.emit('comment:read', comment);
    this.persist();
  }

  markUnread(id: string): void {
    const comment = this.comments.get(id);
    if (!comment || comment.unread) return;
    comment.unread = true;
    this.events.emit('comment:unread', comment);
    this.persist();
  }

  replaceAll(comments: Comment[]): void {
    this.comments.clear();
    for (const comment of comments) {
      this.comments.set(comment.id, comment);
    }
    this.persist();
  }

  clear(): void {
    this.comments.clear();
    this.persist();
  }

  private persist(): void {
    if (this.adapter) {
      Promise.resolve(this.adapter.save(this.getComments())).catch((err) => {
        console.error('Pindrop adapter save failed:', err);
      });
      return;
    }

    if (!this.storageKey) return;
    try {
      const data = JSON.stringify(this.getComments());
      localStorage.setItem(this.storageKey, data);
    } catch {
      // localStorage full or unavailable
    }
  }

  private async load(): Promise<void> {
    if (this.adapter) {
      try {
        const comments = await this.adapter.load();
        for (const comment of comments) {
          this.comments.set(comment.id, comment);
        }
      } catch (err) {
        console.error('Pindrop adapter load failed:', err);
      }
      return;
    }

    if (!this.storageKey) return;
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return;
      const comments: Comment[] = JSON.parse(raw);
      for (const comment of comments) {
        this.comments.set(comment.id, comment);
      }
    } catch {
      // Corrupt or unavailable — start fresh
    }
  }
}

export interface PindropStorageAdapter {
  load(): Promise<Comment[]> | Comment[];
  save(comments: Comment[]): Promise<void> | void;
}

export type CommentScope = Record<string, unknown>;

export interface PindropOptions {
  user?: { name: string };
  zIndex?: number;
  theme?: 'auto' | 'light' | 'dark';
  readOnly?: boolean;
  position?: 'right' | 'left';
  styles?: Record<string, string>;
  storageKey?: string;
  adapter?: PindropStorageAdapter;
  getScope?: (element: Element) => CommentScope | undefined;
  isScopeActive?: (scope: CommentScope) => boolean;
}

export interface Anchor {
  selector: string;
  offsetX: number;
  offsetY: number;
  viewportX: number;
  viewportY: number;
}

export interface Reply {
  id: string;
  author: string;
  text: string;
  createdAt: string;
  updatedAt: string;
}

export interface CommentableElement {
  selector: string;
  label: string;
  rect: { x: number; y: number; width: number; height: number };
}

export interface CommentMeta {
  source?: 'agent' | 'human';
  model?: string;
  [key: string]: unknown;
}

export interface Comment {
  id: string;
  anchor: Anchor;
  scope?: CommentScope;
  author: string;
  text: string;
  createdAt: string;
  updatedAt: string;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
  unread: boolean;
  replies: Reply[];
  meta?: CommentMeta;
}

export interface PindropData {
  version: 1;
  url: string;
  createdAt: string;
  comments: Comment[];
}

export interface ImportResult {
  added: number;
  merged: number;
  unanchored: number;
}

export type PindropEventMap = {
  'comment:add': Comment;
  'comment:delete': Comment;
  'comment:resolve': Comment;
  'comment:reopen': Comment;
  'comment:read': Comment;
  'comment:unread': Comment;
  'reply:add': { comment: Comment; reply: Reply };
  'anchor:lost': Comment;
  'mode:change': { mode: PindropMode };
  'import:complete': ImportResult;
  'export:complete': { commentCount: number };
};

export type PindropMode = 'view' | 'comment' | 'review';

export type PindropEvent = keyof PindropEventMap;

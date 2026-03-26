import type { PindropData, Comment, ImportResult } from '../core/types';
import type { Store } from '../core/store';
import type { EventEmitter } from '../core/events';
import { validatePindropData } from './schema';
import { mergeComments } from './merge';
import { resolveAnchorPosition } from '../anchoring/position';

export function exportComments(store: Store, events: EventEmitter): string {
  const data: PindropData = {
    version: 1,
    url: window.location.href,
    createdAt: new Date().toISOString(),
    comments: store.getComments(),
  };
  const json = JSON.stringify(data, null, 2);

  // Trigger file download
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const title = document.title || 'page';
  const date = new Date().toISOString().split('T')[0];
  a.href = url;
  a.download = `comments-${title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);

  events.emit('export:complete', { commentCount: data.comments.length });
  return json;
}

export function importComments(
  json: string,
  store: Store,
  events: EventEmitter
): ImportResult {
  const parsed = JSON.parse(json);
  const data = validatePindropData(parsed);

  const local = store.getComments();
  const result = mergeComments(local, data.comments);

  store.replaceAll(result.comments);

  // Count unanchored
  let unanchored = 0;
  for (const comment of result.comments) {
    const pos = resolveAnchorPosition(comment.anchor);
    if (!pos.anchored) unanchored++;
  }

  const importResult: ImportResult = {
    added: result.added,
    merged: result.merged,
    unanchored,
  };

  events.emit('import:complete', importResult);
  return importResult;
}

export function openFilePicker(): Promise<string> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        reject(new Error('No file selected'));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    };
    input.click();
  });
}
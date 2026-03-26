import type { PindropData } from '../core/types';

const SUPPORTED_VERSION = 1;

export function validatePindropData(data: unknown): PindropData {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid pindrop data: expected an object');
  }

  const obj = data as Record<string, unknown>;

  // Treat missing version as version 1
  const version = obj.version ?? 1;
  if (typeof version !== 'number' || version > SUPPORTED_VERSION) {
    throw new Error(
      `Unsupported schema version: ${version}. This version of pindrop.js supports version ${SUPPORTED_VERSION}.`
    );
  }

  if (!Array.isArray(obj.comments)) {
    throw new Error('Invalid pindrop data: missing comments array');
  }

  // Validate required fields on each comment
  for (const comment of obj.comments) {
    if (!comment || typeof comment !== 'object') {
      throw new Error('Invalid comment: expected an object');
    }
    if (typeof comment.id !== 'string' || !comment.id) {
      throw new Error('Invalid comment: missing id');
    }
    if (!comment.anchor || typeof comment.anchor !== 'object') {
      throw new Error(`Invalid comment ${comment.id}: missing anchor`);
    }
    if (typeof comment.text !== 'string') {
      throw new Error(`Invalid comment ${comment.id}: missing text`);
    }
  }

  return {
    version: 1,
    url: typeof obj.url === 'string' ? obj.url : '',
    createdAt: typeof obj.createdAt === 'string' ? obj.createdAt : new Date().toISOString(),
    comments: obj.comments,
  };
}
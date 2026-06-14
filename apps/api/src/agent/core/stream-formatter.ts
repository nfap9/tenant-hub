import type { StreamChunk } from '../types.js';

export function statusChunk(content: string): StreamChunk {
  return { type: 'status', content };
}

export function messageChunk(content: string): StreamChunk {
  return { type: 'message', content };
}

export function chartChunk(content: string): StreamChunk {
  return { type: 'chart', content };
}

export function doneChunk(): StreamChunk {
  return { type: 'done', content: '' };
}

export function errorChunk(content: string): StreamChunk {
  return { type: 'error', content };
}

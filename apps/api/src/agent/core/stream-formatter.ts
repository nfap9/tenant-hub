import type { StreamChunk } from '../types.js';
import type { FormField } from '../schema-to-form.js';

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

export function formChunk(
  content: string,
  form: {
    tool: string;
    reason: string;
    fields: FormField[];
  }
): StreamChunk {
  return { type: 'form', content, form };
}

export function actionChunk(
  content: string,
  action: {
    tool: string;
    method: string;
    path: string;
    params: Record<string, unknown>;
    summary: string;
    impact: string[];
    requiresConfirmation: boolean;
  }
): StreamChunk {
  return { type: 'action', content, action };
}

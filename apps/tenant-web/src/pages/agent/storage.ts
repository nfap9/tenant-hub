import type { LocalConversation } from './types';

export function readConversations(storageKey: string): LocalConversation[] {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed as LocalConversation[];
    }
  } catch {
    // ignore corrupted cache
  }
  return [];
}

export function writeConversations(
  storageKey: string,
  conversations: LocalConversation[]
): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(conversations));
  } catch {
    // ignore storage errors
  }
}

export function removeConversation(storageKey: string, id: string): void {
  const list = readConversations(storageKey).filter((c) => c.id !== id);
  writeConversations(storageKey, list);
}

export function dispatchConversationsChange(): void {
  window.dispatchEvent(new Event('agent-conversations-change'));
}

import { useState, useEffect } from 'react';
import type { LocalConversation } from '../types';

export function useAgentChat(orgId: string) {
  const storageKey = `agent_conv_${orgId}_cache`;
  const [conversation, setConversation] = useState<
    LocalConversation | undefined
  >();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setIsReady(true);
  }, []);

  return {
    conversation,
    setConversation,
    isReady,
    storageKey,
  };
}

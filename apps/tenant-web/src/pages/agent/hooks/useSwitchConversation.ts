import { useCallback, useRef } from 'react';
import { message } from 'antd';
import { getConversation } from '@/api/agent';
import type { LocalConversation, DisplayMessage } from '../types';
import {
  readConversations,
  writeConversations,
  dispatchConversationsChange,
} from '../storage';

interface UseSwitchConversationOptions {
  setConversation: React.Dispatch<
    React.SetStateAction<LocalConversation | undefined>
  >;
  storageKey: string;
}

export function useSwitchConversation({
  setConversation,
  storageKey,
}: UseSwitchConversationOptions) {
  const latestIdRef = useRef<string>('');

  const switchConversation = useCallback(
    async (id: string) => {
      latestIdRef.current = id;

      const local = readConversations(storageKey).find((c) => c.id === id);
      if (local) {
        setConversation(local);
      }

      try {
        const server = await getConversation(id);
        // 如果用户已经切换到其它会话，忽略本次过期的服务端响应
        if (latestIdRef.current !== id) {
          return;
        }

        const mapped: LocalConversation = {
          id: server.id,
          serverId: server.id,
          title: server.title,
          updatedAt: new Date(server.updatedAt).getTime(),
          messages: (server.messages as DisplayMessage[]).filter(
            (m) => !['form', 'action'].includes(m.role)
          ),
        };

        setConversation(mapped);

        const list = readConversations(storageKey).filter((c) => c.id !== id);
        writeConversations(storageKey, [mapped, ...list]);
        dispatchConversationsChange();
      } catch {
        if (!local) {
          message.error('加载会话失败');
        }
      }
    },
    [setConversation, storageKey]
  );

  return { switchConversation };
}

import {
  useCallback,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import { message } from 'antd';
import { streamAiResume } from '@/api/ai';
import type { ChatMessage, ChatPendingAction } from '../types';
import {
  applyAgentEventToMessages,
  updatePendingActionInMessages,
} from '../utils/messages';

type Params = {
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  /** resume 流式期间复用全局 streaming 状态（禁用输入框、显示中止按钮） */
  setStreaming: (v: boolean) => void;
  abortRef: MutableRefObject<AbortController | null>;
  /** resume 流结束后全量刷新会话状态，保证卡片终态一致 */
  reloadState: (conversationId: string) => Promise<void>;
};

/** 待确认操作：确认/拒绝 = 调 resume SSE 恢复图执行，流出的事件继续渲染进当前会话 */
export default function usePendingActions({
  setMessages,
  setStreaming,
  abortRef,
  reloadState,
}: Params) {
  const [busyActionId, setBusyActionId] = useState<string | undefined>();

  const handleDecision = useCallback(
    (action: ChatPendingAction, decision: 'approve' | 'reject') => {
      setBusyActionId(action.id);
      setStreaming(true);
      setMessages((prev) =>
        updatePendingActionInMessages(prev, action.id, {
          state: decision === 'approve' ? 'confirming' : 'rejecting',
        })
      );

      abortRef.current = streamAiResume({
        conversationId: action.conversationId,
        actionId: action.id,
        decision,
        onEvent: (event) => {
          // resume 后图继续执行：工具结果 / 文本 / 新的 interrupt 都照常渲染
          setMessages((prev) => applyAgentEventToMessages(prev, event));
          if (event.type === 'error') message.error(event.message);
        },
        onError: (error) => {
          setMessages((prev) =>
            updatePendingActionInMessages(prev, action.id, {
              state: 'pending',
            })
          );
          setStreaming(false);
          setBusyActionId(undefined);
          abortRef.current = null;
          message.error(error.message);
        },
        onClose: () => {
          setStreaming(false);
          setBusyActionId(undefined);
          abortRef.current = null;
          // 流结束后全量刷新：卡片终态（CONFIRMED/REJECTED）以审计记录为准
          reloadState(action.conversationId);
        },
      });
    },
    [setMessages, setStreaming, abortRef, reloadState]
  );

  const handleConfirm = useCallback(
    (action: ChatPendingAction) => handleDecision(action, 'approve'),
    [handleDecision]
  );

  const handleReject = useCallback(
    (action: ChatPendingAction) => handleDecision(action, 'reject'),
    [handleDecision]
  );

  return { busyActionId, handleConfirm, handleReject };
}

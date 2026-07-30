import {
  useCallback,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { message } from 'antd';
import { confirmAiAction, rejectAiAction } from '@/api/ai';
import type { ChatMessage, ChatPendingAction } from '../types';
import { updatePendingActionInMessages } from '../utils/messages';

type Params = {
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
};

/** 待确认操作：确认执行 / 拒绝，并维护忙碌状态 */
export default function usePendingActions({ setMessages }: Params) {
  const [busyActionId, setBusyActionId] = useState<string | undefined>();

  const handleConfirm = useCallback(
    async (action: ChatPendingAction) => {
      setBusyActionId(action.id);
      setMessages((prev) =>
        updatePendingActionInMessages(prev, action.id, { state: 'confirming' })
      );
      try {
        const result = await confirmAiAction(action.id);
        setMessages((prev) =>
          updatePendingActionInMessages(prev, action.id, {
            state: result.ok ? 'confirmed' : 'expired',
            resultSummary: result.summary,
          })
        );
        if (!result.ok) {
          message.warning(result.summary);
        }
      } catch (e) {
        setMessages((prev) =>
          updatePendingActionInMessages(prev, action.id, { state: 'pending' })
        );
        message.error(e instanceof Error ? e.message : '确认失败');
      } finally {
        setBusyActionId(undefined);
      }
    },
    [setMessages]
  );

  const handleReject = useCallback(
    async (action: ChatPendingAction) => {
      setBusyActionId(action.id);
      try {
        await rejectAiAction(action.id);
        setMessages((prev) =>
          updatePendingActionInMessages(prev, action.id, {
            state: 'rejected',
            resultSummary: '用户已拒绝',
          })
        );
      } catch (e) {
        message.error(e instanceof Error ? e.message : '拒绝失败');
      } finally {
        setBusyActionId(undefined);
      }
    },
    [setMessages]
  );

  return { busyActionId, handleConfirm, handleReject };
}

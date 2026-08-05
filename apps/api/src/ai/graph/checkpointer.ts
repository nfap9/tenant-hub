import { Pool } from 'pg';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { env } from '../../config/env.js';

let setupPromise: Promise<PostgresSaver> | null = null;

/**
 * PostgresSaver 单例（惰性初始化，缓存 setup() 的 promise）。
 * 会话消息历史由 checkpointer 承载，thread_id = conversationId。
 */
export const getCheckpointer = (): Promise<PostgresSaver> => {
  if (!setupPromise) {
    const pool = new Pool({ connectionString: env.DATABASE_URL });
    const saver = new PostgresSaver(pool);
    setupPromise = saver.setup().then(() => saver);
    // setup 失败时清空缓存，允许下次重试
    setupPromise.catch(() => {
      setupPromise = null;
    });
  }
  return setupPromise;
};

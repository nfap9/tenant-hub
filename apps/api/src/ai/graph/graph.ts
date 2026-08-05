import {
  StateGraph,
  MessagesAnnotation,
  START,
  END,
} from '@langchain/langgraph';
import { AIMessage } from '@langchain/core/messages';
import { getCheckpointer } from './checkpointer.js';
import { agentNode, toolsNode } from './nodes.js';

/** agent 之后：最后一条消息带 tool_calls → tools，否则结束 */
const routeAfterAgent = (
  state: typeof MessagesAnnotation.State
): 'tools' | typeof END => {
  const last = state.messages[state.messages.length - 1];
  return last instanceof AIMessage && last.tool_calls?.length ? 'tools' : END;
};

const build = async () => {
  const checkpointer = await getCheckpointer();
  return new StateGraph(MessagesAnnotation)
    .addNode('agent', agentNode)
    .addNode('tools', toolsNode)
    .addEdge(START, 'agent')
    .addConditionalEdges('agent', routeAfterAgent)
    .addEdge('tools', 'agent')
    .compile({ checkpointer });
};

let graphPromise: ReturnType<typeof build> | null = null;

/** 编译后的 graph 单例（含 Postgres checkpointer） */
export const getGraph = (): ReturnType<typeof build> => {
  if (!graphPromise) {
    graphPromise = build();
    // 初始化失败时清空缓存，允许下次重试
    graphPromise.catch(() => {
      graphPromise = null;
    });
  }
  return graphPromise;
};

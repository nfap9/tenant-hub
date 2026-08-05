import { useCallback, useEffect, useState } from 'react';
import { listAiModels, type AiModelOption } from '@/api/ai';

/** 加载可用模型列表，并维护当前选中的模型 */
export default function useAiModels(open: boolean) {
  const [models, setModels] = useState<AiModelOption[]>([]);
  const [modelId, setModelId] = useState<string | undefined>();

  const loadModels = useCallback(async () => {
    try {
      const list = await listAiModels();
      setModels(list);
      setModelId((prev) => prev ?? list[0]?.id);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (open) loadModels();
  }, [open, loadModels]);

  return { models, modelId, setModelId };
}

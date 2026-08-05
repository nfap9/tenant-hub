import { Select } from 'antd';
import type { AiModelOption } from '@/api/ai';

type Props = {
  models: AiModelOption[];
  value?: string;
  onChange: (modelId: string) => void;
  className?: string;
};

export default function ModelSelector({
  models,
  value,
  onChange,
  className,
}: Props) {
  return (
    <Select
      size="small"
      className={className}
      placeholder="选择模型"
      value={value}
      onChange={onChange}
      options={models.map((m) => ({
        value: m.id,
        label: m.displayName,
      }))}
    />
  );
}

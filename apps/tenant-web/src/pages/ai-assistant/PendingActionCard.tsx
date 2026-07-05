import { Card, Tag, Button, Space, Typography, Table, Alert } from 'antd';
import {
  CheckOutlined,
  CloseOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import type { ChatPendingAction } from './types';

const riskColor: Record<string, string> = {
  low: 'green',
  medium: 'orange',
  high: 'red',
};

const riskLabel: Record<string, string> = {
  low: '低风险',
  medium: '中风险',
  high: '高风险',
};

type Props = {
  action: ChatPendingAction;
  onConfirm: (action: ChatPendingAction) => void;
  onReject: (action: ChatPendingAction) => void;
  busy?: boolean;
};

export default function PendingActionCard({
  action,
  onConfirm,
  onReject,
  busy,
}: Props) {
  const { summary, state, resultSummary } = action;
  const resolved =
    state === 'confirmed' || state === 'rejected' || state === 'expired';

  return (
    <Card
      size="small"
      style={{ marginTop: 8, borderColor: riskColor[summary.riskLevel] }}
      title={
        <Space size={8}>
          <Tag color={riskColor[summary.riskLevel]}>
            {riskLabel[summary.riskLevel]}
          </Tag>
          <Typography.Text strong>{summary.title}</Typography.Text>
        </Space>
      }
    >
      <Typography.Paragraph style={{ marginBottom: 8 }}>
        {summary.description}
      </Typography.Paragraph>

      {summary.diff.length > 0 && (
        <Table
          size="small"
          pagination={false}
          style={{ marginBottom: 8 }}
          dataSource={summary.diff.map((d, i) => ({ ...d, key: i }))}
          columns={[
            { title: '字段', dataIndex: 'field', key: 'field', width: 120 },
            {
              title: '原值',
              dataIndex: 'oldValue',
              key: 'oldValue',
              render: (v) => (v === undefined || v === null ? '—' : String(v)),
            },
            {
              title: '新值',
              dataIndex: 'newValue',
              key: 'newValue',
              render: (v) => (v === undefined || v === null ? '—' : String(v)),
            },
          ]}
        />
      )}

      {state === 'confirmed' && (
        <Alert
          type="success"
          showIcon
          icon={<CheckCircleOutlined />}
          message={resultSummary || '已执行'}
          style={{ marginBottom: 8 }}
        />
      )}
      {state === 'rejected' && (
        <Alert
          type="info"
          showIcon
          message={resultSummary || '用户已拒绝'}
          style={{ marginBottom: 8 }}
        />
      )}
      {state === 'expired' && (
        <Alert
          type="warning"
          showIcon
          icon={<ExclamationCircleOutlined />}
          message="该操作已过期"
          style={{ marginBottom: 8 }}
        />
      )}

      {!resolved && (
        <Space style={{ marginTop: 4 }}>
          <Button
            type="primary"
            icon={<CheckOutlined />}
            loading={state === 'confirming' || busy}
            onClick={() => onConfirm(action)}
            danger={summary.riskLevel === 'high'}
          >
            确认执行
          </Button>
          <Button
            icon={<CloseOutlined />}
            disabled={state === 'confirming'}
            onClick={() => onReject(action)}
          >
            拒绝
          </Button>
        </Space>
      )}
    </Card>
  );
}

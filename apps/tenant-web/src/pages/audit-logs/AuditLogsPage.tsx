import { useState, useEffect, useCallback } from 'react';
import { Table, DatePicker, Input, Button, Space, message } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useAppSession } from '@/context/AppSessionContext';
import { getAuditLogs, type AuditLog } from '@/api/auditLogs';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';

export default function AuditLogsPage() {
  const { currentOrgId } = useAppSession();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [tableName, setTableName] = useState('');
  const [startDate, setStartDate] = useState<string | undefined>();
  const [endDate, setEndDate] = useState<string | undefined>();

  const load = useCallback(async () => {
    if (!currentOrgId) return;
    setLoading(true);
    try {
      const data = await getAuditLogs(currentOrgId, {
        tableName: tableName || undefined,
        startDate: startDate ? new Date(startDate).toISOString() : undefined,
        endDate: endDate ? new Date(endDate).toISOString() : undefined,
      });
      setLogs(data.items);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [currentOrgId, tableName, startDate, endDate]);

  useEffect(() => {
    load();
  }, [load]);

  const columns = [
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: string) => v.slice(0, 19).replace('T', ' '),
    },
    { title: '操作人', dataIndex: ['user', 'username'], key: 'user' },
    { title: '表名', dataIndex: 'tableName', key: 'tableName' },
    { title: '记录ID', dataIndex: 'recordId', key: 'recordId' },
    { title: '操作', dataIndex: 'action', key: 'action' },
    { title: '字段', dataIndex: 'fieldName', key: 'fieldName' },
    { title: '旧值', dataIndex: 'oldValue', key: 'oldValue' },
    { title: '新值', dataIndex: 'newValue', key: 'newValue' },
  ];

  return (
    <div className="page-content">
      <PageHeader breadcrumb={[{ label: '审计日志' }]} />
      <Space style={{ marginBottom: 16 }}>
        <Input
          placeholder="表名"
          value={tableName}
          onChange={(e) => setTableName(e.target.value)}
          style={{ width: 150 }}
        />
        <DatePicker
          placeholder="开始日期"
          onChange={(_, d) =>
            setStartDate(typeof d === 'string' ? d : undefined)
          }
        />
        <DatePicker
          placeholder="结束日期"
          onChange={(_, d) => setEndDate(typeof d === 'string' ? d : undefined)}
        />
        <Button icon={<SearchOutlined />} onClick={load}>
          查询
        </Button>
      </Space>
      {logs.length === 0 && !loading ? (
        <EmptyState title="暂无审计日志" />
      ) : (
        <Table
          rowKey="id"
          loading={loading}
          dataSource={logs}
          columns={columns}
          pagination={{ pageSize: 20 }}
        />
      )}
    </div>
  );
}

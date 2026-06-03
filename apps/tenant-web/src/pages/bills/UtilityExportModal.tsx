import { useState, useEffect } from 'react';
import { Modal, Form, Select, DatePicker, Button, Space, message } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { useAppSession } from '@/context/AppSessionContext';
import { getApartments } from '@/api/apartments';
import { exportUtilityPendingCsv } from '@/api/bills';
import styles from './UtilityExportPage.module.scss';
import type { Apartment } from '@/types/domain';

interface UtilityExportModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function UtilityExportModal({
  open,
  onClose,
  onSuccess,
}: UtilityExportModalProps) {
  const { currentOrgId } = useAppSession();
  const [form] = Form.useForm();
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!currentOrgId) return;
    setLoading(true);
    getApartments(currentOrgId)
      .then(setApartments)
      .catch((e) => message.error(e instanceof Error ? e.message : '加载失败'))
      .finally(() => setLoading(false));
  }, [currentOrgId]);

  const handleExport = async () => {
    if (!currentOrgId) return;
    setExporting(true);
    try {
      const csv = await exportUtilityPendingCsv(currentOrgId);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `水电读数模板_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      message.success('导出成功');
      onSuccess?.();
      onClose();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '导出失败');
    } finally {
      setExporting(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  return (
    <Modal
      title="导出水电数据"
      open={open}
      onCancel={handleCancel}
      footer={null}
      destroyOnClose
    >
      <Form form={form} layout="vertical" className={styles.utilityExportForm}>
        <Form.Item label="公寓" name="apartmentId">
          <Select
            placeholder="全部公寓"
            loading={loading}
            allowClear
            options={apartments.map((a) => ({ label: a.name, value: a.id }))}
          />
        </Form.Item>
        <Form.Item label="月份" name="month">
          <DatePicker.MonthPicker className="w-full" />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              loading={exporting}
              onClick={handleExport}
            >
              导出待录入模板
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
}

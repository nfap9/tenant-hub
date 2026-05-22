import { useState } from 'react';
import { View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useAppSession } from '../../context/AppSessionContext';
import { apiClient } from '../../api/client';
import { Button, Card, Input } from '../../components/ui';
import './index.scss';

export default function UtilityImportPage() {
  const { currentOrgId } = useAppSession();

  const [csv, setCsv] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleBack = () => {
    Taro.navigateBack();
  };

  const handleSubmit = async () => {
    if (!currentOrgId || !csv.trim()) return;
    setSubmitting(true);
    try {
      await apiClient('/bills/utility/import', {
        method: 'POST',
        body: { csv },
        organizationId: currentOrgId,
      });
      Taro.showToast({ title: '水电读数已导入', icon: 'success' });
      Taro.navigateBack();
    } catch (e) {
      Taro.showToast({
        title: e instanceof Error ? e.message : '导入失败',
        icon: 'none',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className="page-container">
      <View className="sub-page-header">
        <Button
          className="page-back-button"
          variant="ghost"
          size="small"
          onClick={handleBack}
        >
          ‹ 返回
        </Button>
      </View>
      <Card title="导入水电读数">
        <Input
          label="CSV 内容"
          placeholder="粘贴 CSV 内容"
          value={csv}
          onChange={setCsv}
        />
        <Button
          loading={submitting}
          disabled={submitting}
          onClick={handleSubmit}
        >
          确认导入
        </Button>
        <Button variant="ghost" onClick={handleBack}>
          取消
        </Button>
      </Card>
    </View>
  );
}

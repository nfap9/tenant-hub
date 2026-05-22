import { useState, useEffect } from 'react';
import { View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { useAppSession } from '../../context/AppSessionContext';
import { apiClient } from '../../api/client';
import { Button, Card, Input } from '../../components/ui';
import './index.scss';

export default function UtilityPage() {
  const { currentOrgId } = useAppSession();
  const { params } = useRouter();
  const billId = params.billId;

  const [form, setForm] = useState({
    previousWater: '',
    currentWater: '',
    previousPower: '',
    currentPower: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!currentOrgId || !billId) return;
    apiClient(`/bills/${billId}`, { organizationId: currentOrgId })
      .then((bill: any) => {
        const water = bill.items?.find((item: any) => item.type === 'WATER');
        const power = bill.items?.find((item: any) => item.type === 'POWER');
        setForm({
          previousWater: water?.previousWater
            ? String(water.previousWater)
            : '',
          currentWater: water?.currentWater ? String(water.currentWater) : '',
          previousPower: power?.previousPower
            ? String(power.previousPower)
            : '',
          currentPower: power?.currentPower ? String(power.currentPower) : '',
        });
      })
      .catch((e) =>
        Taro.showToast({
          title: e instanceof Error ? e.message : '加载失败',
          icon: 'none',
        })
      );
  }, [currentOrgId, billId]);

  const handleBack = () => {
    Taro.navigateBack();
  };

  const handleSubmit = async () => {
    if (!currentOrgId || !billId) return;
    setSubmitting(true);
    try {
      await apiClient(`/bills/${billId}/utility-reading`, {
        method: 'POST',
        body: {
          previousWater: Number(form.previousWater || 0),
          currentWater: Number(form.currentWater || 0),
          previousPower: Number(form.previousPower || 0),
          currentPower: Number(form.currentPower || 0),
        },
        organizationId: currentOrgId,
      });
      Taro.showToast({ title: '水电读数已录入', icon: 'success' });
      Taro.navigateBack();
    } catch (e) {
      Taro.showToast({
        title: e instanceof Error ? e.message : '水电录入失败',
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
      <Card title="录入本期水电">
        <View className="form-grid">
          <View>
            <Input
              label="上期水表"
              placeholder="请输入读数"
              type="number"
              value={form.previousWater}
              onChange={(value) =>
                setForm((old) => ({ ...old, previousWater: value }))
              }
            />
          </View>
          <View>
            <Input
              label="本期水表"
              placeholder="请输入读数"
              type="number"
              value={form.currentWater}
              onChange={(value) =>
                setForm((old) => ({ ...old, currentWater: value }))
              }
            />
          </View>
        </View>
        <View className="form-grid">
          <View>
            <Input
              label="上期电表"
              placeholder="请输入读数"
              type="number"
              value={form.previousPower}
              onChange={(value) =>
                setForm((old) => ({ ...old, previousPower: value }))
              }
            />
          </View>
          <View>
            <Input
              label="本期电表"
              placeholder="请输入读数"
              type="number"
              value={form.currentPower}
              onChange={(value) =>
                setForm((old) => ({ ...old, currentPower: value }))
              }
            />
          </View>
        </View>
        <Button
          loading={submitting}
          disabled={submitting}
          onClick={handleSubmit}
        >
          保存水电读数
        </Button>
        <Button variant="ghost" onClick={handleBack}>
          取消
        </Button>
      </Card>
    </View>
  );
}

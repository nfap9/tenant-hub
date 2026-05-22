import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, Button, Input, Space, Spin, message } from 'antd';
import {
  SaveOutlined,
  ThunderboltOutlined,
  DashboardOutlined,
} from '@ant-design/icons';
import { useAppSession } from '@/context/AppSessionContext';
import { getBillDetail, recordUtilityReading } from '@/api/bills';
import PageHeader from '@/components/ui/PageHeader';
import './UtilityPage.scss';

export default function UtilityPage() {
  const { currentOrgId } = useAppSession();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const billId = searchParams.get('billId');

  const [form, setForm] = useState({
    previousWater: '',
    currentWater: '',
    previousPower: '',
    currentPower: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentOrgId || !billId) return;
    setLoading(true);
    getBillDetail(currentOrgId, billId)
      .then((bill) => {
        const water = bill.items?.find((item) => item.type === 'WATER');
        const power = bill.items?.find((item) => item.type === 'POWER');
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
      .catch((e) => message.error(e instanceof Error ? e.message : '加载失败'))
      .finally(() => setLoading(false));
  }, [currentOrgId, billId]);

  const handleSubmit = async () => {
    if (!currentOrgId || !billId) return;
    setSubmitting(true);
    try {
      await recordUtilityReading(currentOrgId, billId, {
        previousWater: Number(form.previousWater || 0),
        currentWater: Number(form.currentWater || 0),
        previousPower: Number(form.previousPower || 0),
        currentPower: Number(form.currentPower || 0),
      });
      message.success('水电读数已录入');
      navigate(-1);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '水电录入失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-content">
      <PageHeader
        back={true}
        breadcrumb={[
          { label: '财务管理', path: '/bills' },
          { label: '录入本期水电' },
        ]}
      />

      <Spin spinning={loading}>
        <Card
          title={
            <span className="utility-card-title">
              <DashboardOutlined />
              水表读数
            </span>
          }
          className="utility-mb-24"
        >
          <Space
            direction="vertical"
            className="utility-space-full"
            size="middle"
          >
            <Input
              placeholder="上期水表读数"
              prefix={<ThunderboltOutlined />}
              size="large"
              value={form.previousWater}
              onChange={(e) =>
                setForm((old) => ({ ...old, previousWater: e.target.value }))
              }
            />
            <Input
              placeholder="本期水表读数"
              prefix={<ThunderboltOutlined />}
              size="large"
              value={form.currentWater}
              onChange={(e) =>
                setForm((old) => ({ ...old, currentWater: e.target.value }))
              }
            />
          </Space>
        </Card>

        <Card
          title={
            <span className="utility-card-title">
              <DashboardOutlined />
              电表读数
            </span>
          }
          className="utility-mb-24"
        >
          <Space
            direction="vertical"
            className="utility-space-full"
            size="middle"
          >
            <Input
              placeholder="上期电表读数"
              prefix={<ThunderboltOutlined />}
              size="large"
              value={form.previousPower}
              onChange={(e) =>
                setForm((old) => ({ ...old, previousPower: e.target.value }))
              }
            />
            <Input
              placeholder="本期电表读数"
              prefix={<ThunderboltOutlined />}
              size="large"
              value={form.currentPower}
              onChange={(e) =>
                setForm((old) => ({ ...old, currentPower: e.target.value }))
              }
            />
          </Space>
        </Card>

        <Button
          type="primary"
          icon={<SaveOutlined />}
          loading={submitting}
          onClick={handleSubmit}
          block
          size="large"
        >
          保存水电读数
        </Button>
      </Spin>
    </div>
  );
}

// PAGE-216: 表具详情页面
// PAGE-217: 表具更换页面/弹窗
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Tag,
  Spin,
  message,
  Row,
  Col,
  Popconfirm,
  Modal,
  Form,
  Input,
} from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  ToolOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import { useAppSession, useHasPermission } from '@/context/AppSessionContext';
import { getMeters, deleteMeter, replaceMeter } from '@/api/meters';
import type { Meter } from '@/types/domain';
import PageHeader from '@/components/ui/PageHeader';
import DetailSection from '@/components/ui/DetailSection';
import DetailItem from '@/components/ui/DetailItem';

const meterTypeLabels: Record<string, string> = {
  WATER: '水表',
  POWER: '电表',
  GAS: '气表',
};

const statusLabels: Record<string, string> = {
  ACTIVE: '在用',
  REMOVED: '已拆除',
};

export default function MeterDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentOrgId } = useAppSession();
  const canManage = useHasPermission('apartment:manage');

  const [meter, setMeter] = useState<Meter | null>(null);
  const [loading, setLoading] = useState(false);
  const [replaceModalOpen, setReplaceModalOpen] = useState(false);
  const [replaceForm] = Form.useForm();

  const loadData = useCallback(async () => {
    if (!currentOrgId || !id) return;
    setLoading(true);
    try {
      const data = await getMeters(currentOrgId);
      const found = data.find((m) => m.id === id);
      if (found) setMeter(found);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载表具详情失败');
    } finally {
      setLoading(false);
    }
  }, [currentOrgId, id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDelete = async () => {
    if (!currentOrgId || !id) return;
    try {
      await deleteMeter(currentOrgId, id);
      message.success('删除成功');
      navigate('/meters');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '删除失败');
    }
  };

  const handleReplace = async (values: { name: string; meterNo?: string }) => {
    if (!currentOrgId || !id) return;
    try {
      await replaceMeter(currentOrgId, id, values);
      message.success('更换成功');
      setReplaceModalOpen(false);
      replaceForm.resetFields();
      loadData();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '更换失败');
    }
  };

  if (!meter && !loading) {
    return (
      <div className="page-content">
        <PageHeader breadcrumb={[{ label: '表具管理' }, { label: '详情' }]} />
        <div>表具不存在</div>
      </div>
    );
  }

  return (
    <div className="page-content">
      <PageHeader
        breadcrumb={[
          { label: '表具管理', path: '/meters' },
          { label: meter?.name || '详情' },
        ]}
      />

      <Spin spinning={loading}>
        {meter && (
          <DetailSection
            title={
              <>
                <ToolOutlined /> 表具档案
              </>
            }
            actions={
              canManage && (
                <>
                  <Button
                    icon={<EditOutlined />}
                    onClick={() => navigate(`/meters/${meter.id}/edit`)}
                  >
                    编辑
                  </Button>
                  <Button
                    icon={<SwapOutlined />}
                    onClick={() => setReplaceModalOpen(true)}
                  >
                    更换
                  </Button>
                  <Popconfirm
                    title="确认删除？"
                    description="删除后不可恢复"
                    onConfirm={handleDelete}
                  >
                    <Button danger icon={<DeleteOutlined />}>
                      删除
                    </Button>
                  </Popconfirm>
                </>
              )
            }
          >
            <Row gutter={[24, 0]}>
              <Col span={8}>
                <DetailItem label="表具名称">{meter.name}</DetailItem>
              </Col>
              <Col span={8}>
                <DetailItem label="表具编号">{meter.meterNo || '-'}</DetailItem>
              </Col>
              <Col span={8}>
                <DetailItem label="类型">
                  {meterTypeLabels[meter.meterType] || meter.meterType}
                </DetailItem>
              </Col>
              <Col span={8}>
                <DetailItem label="所属公寓">
                  {meter.apartment?.name || '-'}
                </DetailItem>
              </Col>
              <Col span={8}>
                <DetailItem label="所属房间">
                  {meter.room?.roomNo || '-'}
                </DetailItem>
              </Col>
              <Col span={8}>
                <DetailItem label="状态">
                  <Tag
                    color={meter.status === 'ACTIVE' ? 'success' : 'default'}
                  >
                    {statusLabels[meter.status] || meter.status}
                  </Tag>
                </DetailItem>
              </Col>
              <Col span={8}>
                <DetailItem label="安装日期">
                  {meter.installDate || '-'}
                </DetailItem>
              </Col>
              {meter.parent && (
                <Col span={8}>
                  <DetailItem label="父表">{meter.parent.name}</DetailItem>
                </Col>
              )}
              {meter.subMeters && meter.subMeters.length > 0 && (
                <Col span={8}>
                  <DetailItem label="子表">
                    {meter.subMeters.map((s) => s.name).join(', ')}
                  </DetailItem>
                </Col>
              )}
              <Col span={8}>
                <DetailItem label="读数记录数">
                  {meter._count?.readings ?? 0}
                </DetailItem>
              </Col>
            </Row>
          </DetailSection>
        )}
      </Spin>

      <Modal
        title="更换表具"
        open={replaceModalOpen}
        onCancel={() => {
          setReplaceModalOpen(false);
          replaceForm.resetFields();
        }}
        onOk={() => replaceForm.submit()}
      >
        <Form form={replaceForm} layout="vertical" onFinish={handleReplace}>
          <Form.Item
            label="新表具名称"
            name="name"
            rules={[{ required: true, message: '请输入新表具名称' }]}
          >
            <Input placeholder="请输入新表具名称" />
          </Form.Item>
          <Form.Item label="新表具编号" name="meterNo">
            <Input placeholder="请输入新表具编号" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

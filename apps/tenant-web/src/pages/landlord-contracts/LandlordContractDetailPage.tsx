import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Tag, Spin, message, Row, Col, Popconfirm } from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { useAppSession, useHasPermission } from '@/context/AppSessionContext';
import {
  getLandlordContract,
  deleteLandlordContract,
} from '@/api/landlordContracts';
import type { LandlordContract } from '@/api/landlordContracts';
import { money, day } from '@/utils/format';
import PageHeader from '@/components/ui/PageHeader';
import DetailSection from '@/components/ui/DetailSection';
import DetailItem from '@/components/ui/DetailItem';

const paymentMethodLabels: Record<string, string> = {
  MONTHLY: '月付',
  QUARTERLY: '季付',
  HALF_YEARLY: '半年付',
  YEARLY: '年付',
};

const escalationTypeLabels: Record<string, string> = {
  NONE: '无递增',
  FIXED: '固定金额',
  PERCENTAGE: '百分比',
};

export default function LandlordContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentOrgId } = useAppSession();
  const canManage = useHasPermission('apartment:manage');

  const [contract, setContract] = useState<LandlordContract | null>(null);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!currentOrgId || !id) return;
    setLoading(true);
    try {
      const data = await getLandlordContract(currentOrgId, id);
      setContract(data);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载合同详情失败');
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
      await deleteLandlordContract(currentOrgId, id);
      message.success('删除成功');
      navigate('/landlord-contracts');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '删除失败');
    }
  };

  if (!contract && !loading) {
    return (
      <div className="page-content">
        <PageHeader breadcrumb={[{ label: '房东合同' }, { label: '详情' }]} />
        <div>合同不存在</div>
      </div>
    );
  }

  return (
    <div className="page-content">
      <PageHeader
        breadcrumb={[
          {
            label: '房东合同',
            path: '/landlord-contracts',
          },
          { label: contract?.contractNo || '详情' },
        ]}
      />

      <Spin spinning={loading}>
        {contract && (
          <>
            <DetailSection
              title={
                <>
                  <FileTextOutlined /> 合同信息
                </>
              }
              actions={
                canManage && (
                  <>
                    <Button
                      icon={<EditOutlined />}
                      onClick={() =>
                        navigate(`/landlord-contracts/${contract.id}/edit`)
                      }
                    >
                      编辑
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
                  <DetailItem label="合同编号">
                    {contract.contractNo || '-'}
                  </DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="所属公寓">
                    {contract.apartment?.name || '-'}
                  </DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="状态">
                    <Tag color={contract.isActive ? 'success' : 'default'}>
                      {contract.isActive ? '生效中' : '已结束'}
                    </Tag>
                  </DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="开始日期">
                    {day(contract.startDate)}
                  </DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="结束日期">
                    {day(contract.endDate)}
                  </DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="签约日期">
                    {contract.signDate ? day(contract.signDate) : '-'}
                  </DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="月租金">
                    {money(contract.rentAmount)}
                  </DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="押金">
                    {money(contract.depositAmount)}
                  </DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="付款方式">
                    {paymentMethodLabels[contract.paymentMethod] ||
                      contract.paymentMethod}
                  </DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="免租期">
                    {contract.freeRentDays > 0
                      ? `${contract.freeRentDays} 天`
                      : '-'}
                  </DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="免租起止">
                    {contract.freeRentStart && contract.freeRentEnd
                      ? `${day(contract.freeRentStart)} ~ ${day(contract.freeRentEnd)}`
                      : '-'}
                  </DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="递增类型">
                    {contract.escalationType
                      ? escalationTypeLabels[contract.escalationType]
                      : '-'}
                  </DetailItem>
                </Col>
                {contract.escalationType && (
                  <>
                    <Col span={8}>
                      <DetailItem label="递增数值">
                        {contract.escalationValue || '-'}
                      </DetailItem>
                    </Col>
                    <Col span={8}>
                      <DetailItem label="递增周期">
                        {contract.escalationCycle
                          ? `${contract.escalationCycle} 个月`
                          : '-'}
                      </DetailItem>
                    </Col>
                  </>
                )}
                <Col span={8}>
                  <DetailItem label="附件">
                    {contract.attachmentUrl ? (
                      <a
                        href={contract.attachmentUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        查看附件
                      </a>
                    ) : (
                      '-'
                    )}
                  </DetailItem>
                </Col>
                <Col span={24}>
                  <DetailItem label="备注">{contract.note || '-'}</DetailItem>
                </Col>
              </Row>
            </DetailSection>
          </>
        )}
      </Spin>
    </div>
  );
}

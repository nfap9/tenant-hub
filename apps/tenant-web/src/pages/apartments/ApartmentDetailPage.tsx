// PAGE-103: 公寓详情页面
// PAGE-104: 公寓状态变更
// PAGE-106: 公寓可视化看板
import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Button,
  Tabs,
  message,
  Popconfirm,
  Spin,
  Row,
  Col,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  Divider,
} from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import {
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  AppstoreAddOutlined,
  HomeOutlined,
  UserOutlined,
  DollarOutlined,
  SafetyOutlined,
} from '@ant-design/icons';
import { useAppSession, useHasPermission } from '@/context/AppSessionContext';
import {
  getApartment,
  updateApartmentStatus,
  deleteApartment,
} from '@/api/apartments';
import type { Apartment } from '@/types/domain';
import { money, day } from '@/utils/format';
import RoomCard from '@/components/rooms/RoomCard';
import ApartmentDashboard from '@/components/apartments/ApartmentDashboard';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import DetailSection from '@/components/ui/DetailSection';
import DetailItem from '@/components/ui/DetailItem';
import styles from './ApartmentDetailPage.module.scss';

const statusLabels: Record<string, string> = {
  PLANNING: '规划中',
  RENOVATING: '装修中',
  PREPARING: '筹备中',
  ACTIVE: '运营中',
  SUSPENDED: '暂停中',
  CLOSED: '已关闭',
};

const statusColors: Record<string, string> = {
  PLANNING: 'default',
  RENOVATING: 'processing',
  PREPARING: 'warning',
  ACTIVE: 'success',
  SUSPENDED: 'warning',
  CLOSED: 'default',
};

const propertyTypeLabels: Record<string, string> = {
  RESIDENTIAL: '住宅',
  COMMERCIAL: '商业',
  INDUSTRIAL_RENOVATED: '工业改造',
  URBAN_VILLAGE: '城中村',
  OTHER: '其他',
};

const propertyRightLabels: Record<string, string> = {
  OWNED: '自有产权',
  LONG_TERM_LEASE: '长租托管',
  TRUSTEESHIP: '受托管理',
};

const paymentMethodLabels: Record<string, string> = {
  MONTHLY: '月付',
  QUARTERLY: '季付',
  HALF_YEARLY: '半年付',
  YEARLY: '年付',
};

export default function ApartmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentOrgId } = useAppSession();
  const canManageApartment = useHasPermission('apartment:manage');
  const canManageRoom = useHasPermission('room:manage');

  const [apartment, setApartment] = useState<Apartment | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [statusForm] = Form.useForm();
  const [statusSubmitting, setStatusSubmitting] = useState(false);

  const loadApartment = useCallback(async () => {
    if (!currentOrgId || !id) return;
    setLoading(true);
    try {
      const data = await getApartment(currentOrgId, id);
      setApartment(data);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [currentOrgId, id]);

  useEffect(() => {
    loadApartment();
  }, [loadApartment]);

  const apartmentRooms = useMemo(
    () =>
      [...(apartment?.rooms ?? [])].sort((left, right) =>
        left.roomNo.localeCompare(right.roomNo, 'zh-Hans-CN')
      ),
    [apartment]
  );

  const apartmentVacantRooms = useMemo(
    () => apartmentRooms.filter((room) => room.status === 'VACANT').length,
    [apartmentRooms]
  );
  const apartmentOccupiedRooms = useMemo(
    () => apartmentRooms.filter((room) => room.status === 'OCCUPIED').length,
    [apartmentRooms]
  );

  const handleDeleteApartment = async () => {
    if (!apartment || !currentOrgId) return;
    try {
      await deleteApartment(currentOrgId, apartment.id);
      message.success('公寓已删除');
      navigate('/apartments');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '删除公寓失败');
    }
  };

  const handleStatusChange = async (values: {
    status: string;
    reason?: string;
  }) => {
    if (!apartment || !currentOrgId) return;
    setStatusSubmitting(true);
    try {
      await updateApartmentStatus(currentOrgId, apartment.id, {
        status: values.status,
        reason: values.reason,
      });
      message.success('状态已更新');
      setStatusModalOpen(false);
      statusForm.resetFields();
      loadApartment();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '状态更新失败');
    } finally {
      setStatusSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="page-content">
        <PageHeader
          back="/apartments"
          breadcrumb={[
            { label: '公寓管理', path: '/apartments' },
            { label: '公寓详情' },
          ]}
        />
        <div style={{ padding: '120px 0', textAlign: 'center' }}>
          <Spin size="large" />
        </div>
      </div>
    );
  }

  if (!apartment) {
    return (
      <div className="page-content">
        <PageHeader
          back="/apartments"
          breadcrumb={[
            { label: '公寓管理', path: '/apartments' },
            { label: '公寓详情' },
          ]}
        />
        <EmptyState
          title="公寓不存在或已删除"
          description="该公寓可能已被删除或您没有访问权限"
        />
      </div>
    );
  }

  return (
    <div className="page-content">
      <PageHeader
        back="/apartments"
        breadcrumb={[
          { label: '公寓管理', path: '/apartments' },
          { label: apartment.name },
        ]}
      />
      <Tabs
        items={[
          {
            key: 'detail',
            label: '公寓详情',
            children: (
              <>
                {/* 基本信息 */}
                <DetailSection
                  title={
                    <>
                      <HomeOutlined className="text-primary" /> 基本信息
                    </>
                  }
                  actions={
                    canManageApartment && (
                      <>
                        <Button
                          icon={<EditOutlined />}
                          onClick={() => navigate(`/apartments/${id}/edit`)}
                        >
                          编辑
                        </Button>
                        <Popconfirm
                          title="删除公寓"
                          description="删除后公寓及下属所有房间资料不可恢复，请确认当前公寓没有有效租约。"
                          onConfirm={handleDeleteApartment}
                          okText="确认删除"
                          cancelText="取消"
                          okButtonProps={{ danger: true }}
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
                      <DetailItem label="地址">
                        {apartment.location || '未填写'}
                      </DetailItem>
                    </Col>
                    <Col span={8}>
                      <DetailItem label="状态">
                        {apartment.status ? (
                          <Tag
                            color={statusColors[apartment.status] || 'default'}
                          >
                            {statusLabels[apartment.status] || apartment.status}
                          </Tag>
                        ) : (
                          '-'
                        )}
                      </DetailItem>
                    </Col>
                    <Col span={8}>
                      <DetailItem label="物业类型">
                        {apartment.propertyType
                          ? propertyTypeLabels[apartment.propertyType] ||
                            apartment.propertyType
                          : '-'}
                      </DetailItem>
                    </Col>
                    <Col span={8}>
                      <DetailItem label="楼层数">
                        {apartment.floors} 层
                      </DetailItem>
                    </Col>
                    <Col span={8}>
                      <DetailItem label="建筑年代">
                        {apartment.buildYear || '-'}
                      </DetailItem>
                    </Col>
                    <Col span={8}>
                      <DetailItem label="电梯数量">
                        {apartment.elevatorCount ?? 0} 部
                      </DetailItem>
                    </Col>
                    <Col span={8}>
                      <DetailItem label="占地面积">
                        {apartment.landArea
                          ? `${apartment.landArea} ㎡`
                          : '未填'}
                      </DetailItem>
                    </Col>
                    <Col span={8}>
                      <DetailItem label="总面积">
                        {apartment.totalArea
                          ? `${apartment.totalArea} ㎡`
                          : '未填'}
                      </DetailItem>
                    </Col>
                    <Col span={8}>
                      <DetailItem label="公摊比例">
                        {apartment.publicAreaRatio
                          ? `${Number(apartment.publicAreaRatio) * 100}%`
                          : '-'}
                      </DetailItem>
                    </Col>
                    <Col span={8}>
                      <DetailItem label="产权类型">
                        {apartment.propertyRight
                          ? propertyRightLabels[apartment.propertyRight] ||
                            apartment.propertyRight
                          : '-'}
                      </DetailItem>
                    </Col>
                    {apartment.statusReason && (
                      <Col span={8}>
                        <DetailItem label="状态变更原因">
                          {apartment.statusReason}
                        </DetailItem>
                      </Col>
                    )}
                    {apartment.statusChangedAt && (
                      <Col span={8}>
                        <DetailItem label="状态变更时间">
                          {day(apartment.statusChangedAt)}
                        </DetailItem>
                      </Col>
                    )}
                  </Row>
                </DetailSection>

                {apartment.landlordContracts &&
                  apartment.landlordContracts.length > 0 && (
                    <>
                      <Divider />
                      <DetailSection
                        title={
                          <>
                            <UserOutlined className="text-primary" />{' '}
                            房东合同列表
                          </>
                        }
                      >
                        <div style={{ overflowX: 'auto' }}>
                          <table className={styles.simpleTable}>
                            <thead>
                              <tr>
                                <th>合同编号</th>
                                <th>合同期</th>
                                <th>租金</th>
                                <th>押金</th>
                                <th>付款方式</th>
                                <th>状态</th>
                                <th>操作</th>
                              </tr>
                            </thead>
                            <tbody>
                              {apartment.landlordContracts.map((lc) => (
                                <tr key={lc.id}>
                                  <td>{lc.contractNo || '-'}</td>
                                  <td>
                                    {day(lc.startDate)} ~ {day(lc.endDate)}
                                  </td>
                                  <td>¥{money(lc.rentAmount)}</td>
                                  <td>¥{money(lc.depositAmount)}</td>
                                  <td>
                                    {paymentMethodLabels[lc.paymentMethod] ||
                                      lc.paymentMethod}
                                  </td>
                                  <td>
                                    <Tag
                                      color={
                                        lc.isActive ? 'success' : 'default'
                                      }
                                    >
                                      {lc.isActive ? '有效' : '已失效'}
                                    </Tag>
                                  </td>
                                  <td>
                                    <Button
                                      type="link"
                                      size="small"
                                      onClick={() =>
                                        navigate(`/landlord-contracts/${lc.id}`)
                                      }
                                    >
                                      查看
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </DetailSection>
                    </>
                  )}

                {/* 运营配置 */}
                <DetailSection
                  title={
                    <>
                      <DollarOutlined className="text-primary" /> 运营配置
                    </>
                  }
                >
                  <Row gutter={[24, 0]}>
                    <Col span={8}>
                      <DetailItem label="电费成本单价">
                        {apartment.costElectricityPrice
                          ? `${apartment.costElectricityPrice} 元/度`
                          : '-'}
                      </DetailItem>
                    </Col>
                    <Col span={8}>
                      <DetailItem label="水费成本单价">
                        {apartment.costWaterPrice
                          ? `${apartment.costWaterPrice} 元/吨`
                          : '-'}
                      </DetailItem>
                    </Col>
                    <Col span={8}>
                      <DetailItem label="燃气成本单价">
                        {apartment.costGasPrice
                          ? `${apartment.costGasPrice} 元/立方米`
                          : '-'}
                      </DetailItem>
                    </Col>
                    <Col span={8}>
                      <DetailItem label="账单提醒日">
                        {apartment.reminderDay
                          ? `每月 ${apartment.reminderDay} 号`
                          : '-'}
                      </DetailItem>
                    </Col>
                  </Row>
                </DetailSection>

                {/* 消防与安全 */}
                <DetailSection
                  title={
                    <>
                      <SafetyOutlined className="text-primary" /> 消防与安全
                    </>
                  }
                >
                  <Row gutter={[24, 0]}>
                    <Col span={8}>
                      <DetailItem label="消防等级">
                        {apartment.fireRating || '-'}
                      </DetailItem>
                    </Col>
                    <Col span={8}>
                      <DetailItem label="灭火器数量">
                        {apartment.fireExtinguisherCount ?? '-'}
                      </DetailItem>
                    </Col>
                    <Col span={8}>
                      <DetailItem label="逃生通道数量">
                        {apartment.escapeRouteCount ?? '-'}
                      </DetailItem>
                    </Col>
                  </Row>
                </DetailSection>

                {/* 经营花费 */}
                <DetailSection
                  title={
                    <>
                      <DollarOutlined className="text-primary" /> 经营花费
                    </>
                  }
                  actions={
                    canManageApartment && (
                      <Button
                        type="primary"
                        size="small"
                        icon={<PlusOutlined />}
                        onClick={() => navigate(`/apartments/${id}/expenses`)}
                      >
                        记录花费
                      </Button>
                    )
                  }
                >
                  {(apartment.expenses ?? []).length === 0 ? (
                    <EmptyState
                      title="暂无经营花费记录"
                      description="点击右上角按钮记录第一笔经营花费"
                      action={
                        canManageApartment
                          ? {
                              label: '记录花费',
                              onClick: () =>
                                navigate(`/apartments/${id}/expenses`),
                            }
                          : undefined
                      }
                    />
                  ) : (
                    <div className={styles.expenseList}>
                      {(apartment.expenses ?? []).map((item) => (
                        <div key={item.id} className={styles.expenseItem}>
                          <span>
                            {item.name}
                            {item.category?.name && (
                              <Tag style={{ marginLeft: 8, fontSize: 12 }}>
                                {item.category.name}
                              </Tag>
                            )}
                            · {item.spentAt.slice(0, 10)}
                          </span>
                          <span className={styles.expenseAmount}>
                            ¥{money(item.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </DetailSection>
              </>
            ),
          },
          {
            key: 'dashboard',
            label: '经营看板',
            children:
              id && currentOrgId ? (
                <ApartmentDashboard
                  apartmentId={id}
                  currentOrgId={currentOrgId}
                />
              ) : null,
          },
          {
            key: 'rooms',
            label: `房间列表 (${apartmentRooms.length})`,
            children: (
              <div>
                <div className={styles.roomsHeader}>
                  <div className={styles.roomsTitle}>
                    <span className={styles.roomsTitleText}>房间概览</span>
                    <div className={styles.roomsStats}>
                      <span>共 {apartmentRooms.length} 间</span>
                      <span>·</span>
                      <span className="text-success">
                        空闲 {apartmentVacantRooms} 间
                      </span>
                      <span>·</span>
                      <span className="text-warning">
                        已租 {apartmentOccupiedRooms} 间
                      </span>
                    </div>
                  </div>
                  {canManageRoom && (
                    <div className={styles.actionGroup}>
                      <Button
                        icon={<PlusOutlined />}
                        onClick={() => navigate(`/rooms/new?apartmentId=${id}`)}
                      >
                        新增房间
                      </Button>
                      <Button
                        icon={<AppstoreAddOutlined />}
                        onClick={() =>
                          navigate(`/apartments/${id}/rooms/batch`)
                        }
                      >
                        批量添加
                      </Button>
                    </div>
                  )}
                </div>
                {apartmentRooms.length === 0 ? (
                  <EmptyState
                    title="暂无房间"
                    description="可以新增单个房间或批量添加"
                    action={
                      canManageRoom
                        ? {
                            label: '新增房间',
                            onClick: () =>
                              navigate(`/rooms/new?apartmentId=${id}`),
                          }
                        : undefined
                    }
                  />
                ) : (
                  <div className={styles.roomsGrid}>
                    {apartmentRooms.map((room) => (
                      <RoomCard
                        key={room.id}
                        room={room}
                        apartmentName={apartment.name}
                      />
                    ))}
                  </div>
                )}
              </div>
            ),
          },
        ]}
      />

      <Modal
        title="变更公寓状态"
        open={statusModalOpen}
        onCancel={() => {
          setStatusModalOpen(false);
          statusForm.resetFields();
        }}
        onOk={() => statusForm.submit()}
        confirmLoading={statusSubmitting}
      >
        <Form form={statusForm} layout="vertical" onFinish={handleStatusChange}>
          <Form.Item
            label="新状态"
            name="status"
            rules={[{ required: true, message: '请选择新状态' }]}
          >
            <Select
              options={[
                { label: '规划中', value: 'PLANNING' },
                { label: '装修中', value: 'RENOVATING' },
                { label: '筹备中', value: 'PREPARING' },
                { label: '运营中', value: 'ACTIVE' },
                { label: '暂停中', value: 'SUSPENDED' },
                { label: '已关闭', value: 'CLOSED' },
              ]}
            />
          </Form.Item>
          <Form.Item label="变更原因" name="reason">
            <Input.TextArea rows={3} placeholder="可选：填写状态变更原因" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

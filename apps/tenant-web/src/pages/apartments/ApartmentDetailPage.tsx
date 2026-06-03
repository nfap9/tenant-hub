import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Button,
  Tabs,
  message,
  Popconfirm,
  Spin,
  Row,
  Col,
  Divider,
} from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import {
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  AppstoreAddOutlined,
  HomeOutlined,
  DollarOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { useAppSession, useHasPermission } from '@/context/AppSessionContext';
import {
  getApartments,
  deleteApartment,
  getApartmentContract,
  createApartmentContract,
  updateApartmentContract,
  deleteApartmentContract,
} from '@/api/apartments';
import type { Apartment, ApartmentContract } from '@/types/domain';
import { money } from '@/utils/format';
import { contractText } from './utils';
import RoomCard from '@/components/rooms/RoomCard';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import DetailSection from '@/components/ui/DetailSection';
import DetailItem from '@/components/ui/DetailItem';
import UpstreamContractModal from './UpstreamContractModal';
import ApartmentFormModal from './ApartmentFormModal';
import ApartmentExpenseModal from './ApartmentExpenseModal';
import RoomBatchDrawer from './RoomBatchDrawer';
import RoomFormDrawer from '@/pages/rooms/RoomFormDrawer';
import LeaseFormDrawer from '@/pages/rooms/LeaseFormDrawer';
import ReservationDrawer from '@/pages/rooms/ReservationDrawer';
import styles from './ApartmentDetailPage.module.scss';

export default function ApartmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentOrgId } = useAppSession();
  const canManageApartment = useHasPermission('apartment:manage');
  const canManageRoom = useHasPermission('room:manage');

  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [contract, setContract] = useState<ApartmentContract | null>(null);
  const [loading, setLoading] = useState(false);
  const [contractLoading, setContractLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [batchDrawerOpen, setBatchDrawerOpen] = useState(false);
  const [formDrawerOpen, setFormDrawerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [leaseDrawerOpen, setLeaseDrawerOpen] = useState(false);
  const [leaseRoomId, setLeaseRoomId] = useState<string>('');
  const [reserveDrawerOpen, setReserveDrawerOpen] = useState(false);
  const [reserveRoomId, setReserveRoomId] = useState<string>('');

  const loadApartments = useCallback(async () => {
    if (!currentOrgId) return;
    setLoading(true);
    try {
      const data = await getApartments(currentOrgId);
      setApartments(data);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [currentOrgId]);

  const loadContract = useCallback(async () => {
    if (!currentOrgId || !id) return;
    setContractLoading(true);
    try {
      const data = await getApartmentContract(currentOrgId, id);
      setContract(data);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载上游合同失败');
    } finally {
      setContractLoading(false);
    }
  }, [currentOrgId, id]);

  useEffect(() => {
    loadApartments();
  }, [loadApartments]);

  useEffect(() => {
    loadContract();
  }, [loadContract]);

  const apartment = useMemo(
    () => apartments.find((a) => a.id === id),
    [apartments, id]
  );
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

  const handleSubmitContract = async (values: Record<string, unknown>) => {
    if (!currentOrgId || !id) return;
    setSubmitting(true);
    try {
      if (contract) {
        await updateApartmentContract(currentOrgId, id, values);
        message.success('上游合同已更新');
      } else {
        await createApartmentContract(currentOrgId, id, values);
        message.success('上游合同已录入');
      }
      setModalOpen(false);
      await loadContract();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteContract = async () => {
    if (!currentOrgId || !id) return;
    try {
      await deleteApartmentContract(currentOrgId, id);
      message.success('上游合同已删除');
      await loadContract();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '删除失败');
    }
  };

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

      <Spin spinning={loading}>
        <Tabs
          items={[
            {
              key: 'detail',
              label: '公寓详情',
              children: (
                <>
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
                            onClick={() => setEditModalOpen(true)}
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
                      <Col span={12}>
                        <DetailItem label="公寓名称">
                          {apartment.name}
                        </DetailItem>
                      </Col>
                      <Col span={12}>
                        <DetailItem label="地址">
                          {apartment.location || '未填写'}
                        </DetailItem>
                      </Col>
                    </Row>
                  </DetailSection>

                  <Divider />

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
                          onClick={() => setExpenseModalOpen(true)}
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
                              {item.name} · {item.spentAt.slice(0, 10)}
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
              key: 'upstream',
              label: '上游信息',
              children: (
                <Spin spinning={contractLoading}>
                  {contract ? (
                    <DetailSection
                      title={
                        <>
                          <FileTextOutlined className="text-primary" /> 上游合同
                        </>
                      }
                      actions={
                        canManageApartment && (
                          <>
                            <Button
                              icon={<EditOutlined />}
                              onClick={() => setModalOpen(true)}
                            >
                              编辑
                            </Button>
                            <Popconfirm
                              title="删除上游合同"
                              description="删除后不可恢复，是否继续？"
                              onConfirm={handleDeleteContract}
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
                          <DetailItem label="房东姓名">
                            {contract.landlordName || '未维护'}
                          </DetailItem>
                        </Col>
                        <Col span={8}>
                          <DetailItem label="联系方式">
                            {contract.landlordPhone || '未维护'}
                          </DetailItem>
                        </Col>
                        <Col span={8}>
                          <DetailItem label="合同期">
                            {contractText(contract)}
                          </DetailItem>
                        </Col>
                        <Col span={8}>
                          <DetailItem label="上游租金">
                            {contract.rentAmount
                              ? `¥${money(contract.rentAmount)}`
                              : '未维护'}
                          </DetailItem>
                        </Col>
                        <Col span={8}>
                          <DetailItem label="楼层数">
                            {contract.floors
                              ? `${contract.floors} 层`
                              : '未维护'}
                          </DetailItem>
                        </Col>
                        <Col span={8}>
                          <DetailItem label="占地面积">
                            {contract.landArea
                              ? `${contract.landArea} ㎡`
                              : '未维护'}
                          </DetailItem>
                        </Col>
                        <Col span={8}>
                          <DetailItem label="总面积">
                            {contract.totalArea
                              ? `${contract.totalArea} ㎡`
                              : '未维护'}
                          </DetailItem>
                        </Col>
                      </Row>
                    </DetailSection>
                  ) : (
                    <EmptyState
                      title="暂无上游合同信息"
                      description="录入与上游房东签订的合同信息及房东信息"
                      action={
                        canManageApartment
                          ? {
                              label: '录入合同',
                              onClick: () => setModalOpen(true),
                            }
                          : undefined
                      }
                    />
                  )}
                </Spin>
              ),
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
                          onClick={() => setFormDrawerOpen(true)}
                        >
                          新增房间
                        </Button>
                        <Button
                          icon={<AppstoreAddOutlined />}
                          onClick={() => setBatchDrawerOpen(true)}
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
                              onClick: () => setFormDrawerOpen(true),
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
                          onStatusChange={loadApartments}
                          onSign={(roomId) => {
                            setLeaseRoomId(roomId);
                            setLeaseDrawerOpen(true);
                          }}
                          onReserve={(roomId) => {
                            setReserveRoomId(roomId);
                            setReserveDrawerOpen(true);
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ),
            },
          ]}
        />
      </Spin>

      <UpstreamContractModal
        open={modalOpen}
        contract={contract}
        onCancel={() => setModalOpen(false)}
        onSubmit={handleSubmitContract}
        submitting={submitting}
      />

      <ApartmentFormModal
        open={editModalOpen}
        apartmentId={apartment.id}
        onCancel={() => setEditModalOpen(false)}
        onSuccess={() => {
          setEditModalOpen(false);
          loadApartments();
        }}
      />

      <ApartmentExpenseModal
        open={expenseModalOpen}
        apartmentId={apartment.id}
        onCancel={() => setExpenseModalOpen(false)}
        onSuccess={() => {
          setExpenseModalOpen(false);
          loadApartments();
        }}
      />

      <RoomBatchDrawer
        open={batchDrawerOpen}
        apartmentId={apartment.id}
        onCancel={() => setBatchDrawerOpen(false)}
        onSuccess={() => {
          setBatchDrawerOpen(false);
          loadApartments();
        }}
      />

      <RoomFormDrawer
        open={formDrawerOpen}
        defaultApartmentId={id}
        onCancel={() => setFormDrawerOpen(false)}
        onSuccess={() => {
          setFormDrawerOpen(false);
          loadApartments();
        }}
      />

      <LeaseFormDrawer
        open={leaseDrawerOpen}
        roomId={leaseRoomId}
        onCancel={() => setLeaseDrawerOpen(false)}
        onSuccess={() => {
          setLeaseDrawerOpen(false);
          loadApartments();
        }}
      />

      <ReservationDrawer
        open={reserveDrawerOpen}
        roomId={reserveRoomId}
        onCancel={() => setReserveDrawerOpen(false)}
        onSuccess={() => {
          setReserveDrawerOpen(false);
          loadApartments();
        }}
      />
    </div>
  );
}

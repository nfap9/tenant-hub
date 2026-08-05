import { useState, useMemo, useEffect, useCallback } from 'react';
import { Button, Tabs, message, Popconfirm, Spin, Row, Col } from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import {
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  AppstoreAddOutlined,
  HomeOutlined,
} from '@ant-design/icons';
import { useAppSession, useHasPermission } from '@/context/AppSessionContext';
import { getApartments, deleteApartment } from '@/api/apartments';
import type { Apartment } from '@/types/domain';
import { money, day } from '@/utils/format';
import RoomCard from '@/components/rooms/RoomCard';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import DetailSection from '@/components/ui/DetailSection';
import DetailItem from '@/components/ui/DetailItem';
import ApartmentFormModal from './ApartmentFormModal';
import RoomBatchDrawer from './RoomBatchDrawer';
import RoomFormDrawer from '@/pages/rooms/RoomFormDrawer';
import LeaseFormDrawer from '@/pages/rooms/LeaseFormDrawer';
import styles from './ApartmentDetailPage.module.scss';

export default function ApartmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentOrgId } = useAppSession();
  const canManageApartment = useHasPermission('apartment:manage');
  const canManageRoom = useHasPermission('room:manage');

  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [loading, setLoading] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [batchDrawerOpen, setBatchDrawerOpen] = useState(false);
  const [formDrawerOpen, setFormDrawerOpen] = useState(false);
  const [leaseDrawerOpen, setLeaseDrawerOpen] = useState(false);
  const [leaseRoomId, setLeaseRoomId] = useState<string>('');

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

  useEffect(() => {
    loadApartments();
  }, [loadApartments]);

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
  const apartmentSelfUseRooms = useMemo(
    () => apartmentRooms.filter((room) => room.status === 'SELF_USE').length,
    [apartmentRooms]
  );

  const handleDeleteApartment = async () => {
    if (!apartment || !currentOrgId) return;
    try {
      await deleteApartment(currentOrgId, apartment.id);
      message.success('公寓已删除');
      navigate('/biz/apartments');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '删除公寓失败');
    }
  };

  if (!apartment) {
    return (
      <div className="page-content">
        <PageHeader
          back="/apartments"
          breadcrumb={[
            { label: '公寓管理', path: '/biz/apartments' },
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
          { label: '公寓管理', path: '/biz/apartments' },
          { label: apartment.name },
        ]}
      />

      <Spin spinning={loading}>
        <Tabs
          items={[
            {
              key: 'info',
              label: '公寓信息',
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
                          {apartment.address || '未填写'}
                        </DetailItem>
                      </Col>
                      <Col span={12}>
                        <DetailItem label="房东姓名">
                          {apartment.landlordName || '未维护'}
                        </DetailItem>
                      </Col>
                      <Col span={12}>
                        <DetailItem label="联系方式">
                          {apartment.landlordPhone || '未维护'}
                        </DetailItem>
                      </Col>
                      <Col span={12}>
                        <DetailItem label="合同期">
                          {apartment.contractStart && apartment.contractEnd
                            ? `${day(apartment.contractStart)} 至 ${day(apartment.contractEnd)}`
                            : '未维护'}
                        </DetailItem>
                      </Col>
                      <Col span={12}>
                        <DetailItem label="上游租金">
                          {apartment.rentAmount
                            ? `¥${money(apartment.rentAmount)}`
                            : '未维护'}
                        </DetailItem>
                      </Col>
                      <Col span={12}>
                        <DetailItem label="楼层数">
                          {apartment.floors
                            ? `${apartment.floors} 层`
                            : '未维护'}
                        </DetailItem>
                      </Col>
                    </Row>
                  </DetailSection>
                </>
              ),
            },
            {
              key: 'rooms',
              label: `房间 (${apartmentRooms.length})`,
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
                        <span>·</span>
                        <span className="text-primary">
                          自用 {apartmentSelfUseRooms} 间
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

      <ApartmentFormModal
        open={editModalOpen}
        apartmentId={apartment.id}
        onCancel={() => setEditModalOpen(false)}
        onSuccess={() => {
          setEditModalOpen(false);
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
    </div>
  );
}

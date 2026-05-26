import { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, Button, Tabs, message, Popconfirm, Spin } from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import {
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  AppstoreAddOutlined,
  HomeOutlined,
  EnvironmentOutlined,
  BuildOutlined,
  AreaChartOutlined,
  UserOutlined,
  PhoneOutlined,
  CalendarOutlined,
  DollarOutlined,
} from '@ant-design/icons';
import { useAppSession, useHasPermission } from '@/context/AppSessionContext';
import { getApartments, deleteApartment } from '@/api/apartments';
import type { Apartment } from '@/types/domain';
import { money } from '@/utils/format';
import { contractText } from './utils';
import RoomCard from '@/components/rooms/RoomCard';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import styles from './ApartmentDetailPage.module.scss';
import clsx from 'clsx';

export default function ApartmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentOrgId } = useAppSession();
  const canManageApartment = useHasPermission('apartment:manage');
  const canManageRoom = useHasPermission('room:manage');

  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [loading, setLoading] = useState(false);

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
        <Card>
          <EmptyState
            title="公寓不存在或已删除"
            description="该公寓可能已被删除或您没有访问权限"
          />
        </Card>
      </div>
    );
  }

  return (
    <div className={clsx(styles.apartmentDetailPage, 'page-content')}>
      <PageHeader
        back="/apartments"
        breadcrumb={[
          { label: '公寓管理', path: '/apartments' },
          { label: apartment.name },
        ]}
        actions={
          canManageApartment && (
            <div className={styles.actionGroup}>
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
            </div>
          )
        }
      />

      <Spin spinning={loading}>
        <Tabs
          items={[
            {
              key: 'detail',
              label: '公寓详情',
              children: (
                <div className={styles.detailGrid}>
                  <Card
                    title={
                      <div className={styles.flexRow}>
                        <HomeOutlined className="text-primary" />
                        基本信息
                      </div>
                    }
                  >
                    <div className={styles.infoCardBody}>
                      <div className={styles.flexRow}>
                        <EnvironmentOutlined className="text-subtle" />
                        <span className={styles.infoLabel}>地址</span>
                        <span className={styles.infoValue}>
                          {apartment.location || '未填写'}
                        </span>
                      </div>
                      <div className={styles.flexRow}>
                        <BuildOutlined className="text-subtle" />
                        <span className={styles.infoLabel}>楼层数</span>
                        <span className={styles.infoValue}>
                          {apartment.floors} 层
                        </span>
                      </div>
                      <div className={styles.flexRow}>
                        <AreaChartOutlined className="text-subtle" />
                        <span className={styles.infoLabel}>占地面积</span>
                        <span className={styles.infoValue}>
                          {apartment.landArea
                            ? `${apartment.landArea} ㎡`
                            : '未填'}
                        </span>
                      </div>
                      <div className={styles.flexRow}>
                        <AreaChartOutlined className="text-subtle" />
                        <span className={styles.infoLabel}>总面积</span>
                        <span className={styles.infoValue}>
                          {apartment.totalArea
                            ? `${apartment.totalArea} ㎡`
                            : '未填'}
                        </span>
                      </div>
                    </div>
                  </Card>

                  <Card
                    title={
                      <div className={styles.flexRow}>
                        <UserOutlined className="text-primary" />
                        上游信息
                      </div>
                    }
                  >
                    <div className={styles.infoCardBody}>
                      <div className={styles.flexRow}>
                        <UserOutlined className="text-subtle" />
                        <span className={styles.infoLabel}>房东姓名</span>
                        <span className={styles.infoValue}>
                          {apartment.landlordName || '未维护'}
                        </span>
                      </div>
                      <div className={styles.flexRow}>
                        <PhoneOutlined className="text-subtle" />
                        <span className={styles.infoLabel}>联系方式</span>
                        <span className={styles.infoValue}>
                          {apartment.landlordPhone || '未维护'}
                        </span>
                      </div>
                      <div className={styles.flexRow}>
                        <CalendarOutlined className="text-subtle" />
                        <span className={styles.infoLabel}>合同期</span>
                        <span className={styles.infoValue}>
                          {contractText(apartment)}
                        </span>
                      </div>
                      <div className={styles.flexRow}>
                        <DollarOutlined className="text-subtle" />
                        <span className={styles.infoLabel}>上游租金</span>
                        <span className={styles.infoValue}>
                          ¥{money(apartment.rentAmount)}
                        </span>
                      </div>
                    </div>
                  </Card>

                  <Card
                    title={
                      <div className={styles.flexRow}>
                        <DollarOutlined className="text-primary" />
                        经营花费
                      </div>
                    }
                    extra={
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
                              {item.name} · {item.spentAt.slice(0, 10)}
                            </span>
                            <span className={styles.expenseAmount}>
                              ¥{money(item.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                </div>
              ),
            },
            {
              key: 'rooms',
              label: `房间列表 (${apartmentRooms.length})`,
              children: (
                <Card
                  title={
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
                  }
                  extra={
                    canManageRoom && (
                      <div className={styles.actionGroup}>
                        <Button
                          icon={<PlusOutlined />}
                          onClick={() =>
                            navigate(`/rooms/new?apartmentId=${id}`)
                          }
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
                    )
                  }
                >
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
                </Card>
              ),
            },
          ]}
        />
      </Spin>
    </div>
  );
}

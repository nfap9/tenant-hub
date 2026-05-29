import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button,
  Tag,
  Spin,
  message,
  Popconfirm,
  Divider,
  Row,
  Col,
  Table,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
} from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  UserAddOutlined,
  EditOutlined as EditLeaseIcon,
  LogoutOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { useAppSession, useHasPermission } from '@/context/AppSessionContext';
import { getRoomDetail, deleteRoom } from '@/api/rooms';
import {
  getRoomChecklists,
  createRoomChecklist,
  deleteRoomChecklist,
  type RoomChecklist,
} from '@/api/roomChecklists';
import type { Room } from '@/types/domain';
import { money, day } from '@/utils/format';
import { statusLabels, toneForStatus, cycleLabels } from './constants';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import DetailSection from '@/components/ui/DetailSection';
import DetailItem from '@/components/ui/DetailItem';
import styles from './RoomDetailPage.module.scss';

const statusColorMap: Record<string, string> = {
  success: 'success',
  neutral: 'default',
  warning: 'warning',
  danger: 'error',
};

export default function RoomDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentOrgId } = useAppSession();
  const canManageRoom = useHasPermission('room:manage');
  const canManageLease = useHasPermission('lease:manage');

  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(false);
  const [checklists, setChecklists] = useState<RoomChecklist[]>([]);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [checklistModalOpen, setChecklistModalOpen] = useState(false);
  const [checklistForm] = Form.useForm();

  const loadData = useCallback(async () => {
    if (!currentOrgId || !id) return;
    setLoading(true);
    try {
      const data = await getRoomDetail(currentOrgId, id);
      setRoom(data);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载房间详情失败');
    } finally {
      setLoading(false);
    }
  }, [currentOrgId, id]);

  const loadChecklists = useCallback(async () => {
    if (!currentOrgId || !id) return;
    setChecklistLoading(true);
    try {
      const data = await getRoomChecklists(currentOrgId, { roomId: id });
      setChecklists(data);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载检查清单失败');
    } finally {
      setChecklistLoading(false);
    }
  }, [currentOrgId, id]);

  useEffect(() => {
    loadData();
    loadChecklists();
  }, [loadData, loadChecklists]);

  const handleDelete = async () => {
    if (!currentOrgId || !room) return;
    if (room.status === 'OCCUPIED') {
      message.warning('已租房间不能删除，请先退租');
      return;
    }
    try {
      await deleteRoom(currentOrgId, room.id);
      message.success('房间已删除');
      navigate('/rooms');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '删除房间失败');
    }
  };

  if (!room && !loading) {
    return (
      <div className="page-content">
        <EmptyState
          title="房间不存在"
          action={{
            label: '返回房间列表',
            onClick: () => navigate('/rooms'),
          }}
        />
      </div>
    );
  }

  const activeLease = room?.leases?.find((l) => l.status === 'ACTIVE');

  return (
    <div className="page-content">
      <PageHeader
        back={true}
        breadcrumb={[
          { label: '房间管理', path: '/rooms' },
          { label: room?.roomNo || '房间详情' },
        ]}
      />

      <Spin spinning={loading}>
        {room && (
          <>
            <DetailSection
              title="房间信息"
              actions={
                canManageRoom && (
                  <>
                    <Button
                      icon={<EditOutlined />}
                      onClick={() => navigate(`/rooms/${room.id}/edit`)}
                    >
                      编辑
                    </Button>
                    <Popconfirm
                      title="删除房间"
                      description="删除后房间资料不可恢复，请确认当前房间没有有效租约。"
                      onConfirm={handleDelete}
                      okText="确认删除"
                      cancelText="取消"
                      disabled={room.status === 'OCCUPIED'}
                      okButtonProps={{ danger: true }}
                    >
                      <Button
                        danger
                        disabled={room.status === 'OCCUPIED'}
                        icon={<DeleteOutlined />}
                      >
                        删除
                      </Button>
                    </Popconfirm>
                  </>
                )
              }
            >
              <Row gutter={[24, 0]}>
                <Col span={8}>
                  <DetailItem label="房间号">{room.roomNo}</DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="状态">
                    <Tag color={statusColorMap[toneForStatus[room.status]]}>
                      {statusLabels[room.status]}
                    </Tag>
                  </DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="所属公寓">
                    {room.apartment?.name}
                  </DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="户型">{room.layout}</DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="面积">
                    {room.area ? `${room.area} ㎡` : '-'}
                  </DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="设施">
                    {room.facilities?.join('、') || '无设施'}
                  </DetailItem>
                </Col>
              </Row>
            </DetailSection>

            {activeLease && (
              <>
                <Divider />
                <DetailSection
                  title="租约信息"
                  actions={
                    canManageLease && (
                      <>
                        <Button
                          icon={<EditLeaseIcon />}
                          onClick={() =>
                            navigate(`/rooms/${room.id}/lease/edit`)
                          }
                        >
                          编辑租约
                        </Button>
                        <Button
                          danger
                          icon={<LogoutOutlined />}
                          onClick={() =>
                            navigate(`/rooms/${room.id}/lease/terminate`)
                          }
                        >
                          退租
                        </Button>
                      </>
                    )
                  }
                >
                  <Row gutter={[24, 0]}>
                    <Col span={8}>
                      <DetailItem label="租客姓名">
                        {activeLease.tenantName}
                      </DetailItem>
                    </Col>
                    <Col span={8}>
                      <DetailItem label="租客电话">
                        {activeLease.tenantPhone}
                      </DetailItem>
                    </Col>
                    <Col span={8}>
                      <DetailItem label="租金">
                        ¥{money(activeLease.rentAmount)}/
                        {cycleLabels[activeLease.cycle]}
                      </DetailItem>
                    </Col>
                    <Col span={8}>
                      <DetailItem label="押金">
                        ¥{money(activeLease.depositAmount)}
                      </DetailItem>
                    </Col>
                    <Col span={8}>
                      <DetailItem label="租期">
                        {day(activeLease.startDate)} 至{' '}
                        {day(activeLease.endDate)}
                      </DetailItem>
                    </Col>
                    <Col span={8}>
                      <DetailItem label="免租期">
                        {activeLease.graceDays} 天
                      </DetailItem>
                    </Col>
                    <Col span={8}>
                      <DetailItem label="水费单价">
                        ¥{money(activeLease.waterUnitPrice)}
                      </DetailItem>
                    </Col>
                    <Col span={8}>
                      <DetailItem label="电费单价">
                        ¥{money(activeLease.powerUnitPrice)}
                      </DetailItem>
                    </Col>
                    <Col span={8}>
                      <DetailItem label="自动续约">
                        {activeLease.autoRenew ? '是' : '否'}
                      </DetailItem>
                    </Col>
                  </Row>
                  {activeLease.fees && activeLease.fees.length > 0 && (
                    <div className={styles.feeSection}>
                      <div className={styles.feeTitle}>附加费用</div>
                      <div className={styles.feeList}>
                        {activeLease.fees.map((fee) => (
                          <Tag key={fee.id}>
                            {fee.name}: ¥{money(fee.amount)}
                          </Tag>
                        ))}
                      </div>
                    </div>
                  )}
                </DetailSection>
              </>
            )}

            {!activeLease && canManageLease && room.status === 'VACANT' && (
              <>
                <Divider />
                <DetailSection
                  title="租约信息"
                  actions={
                    <Button
                      type="primary"
                      icon={<UserAddOutlined />}
                      onClick={() => navigate(`/rooms/${room.id}/lease/new`)}
                    >
                      签约
                    </Button>
                  }
                >
                  <Row gutter={[24, 0]}>
                    <Col span={24}>
                      <DetailItem label="状态">
                        当前房间空闲，暂无租约
                      </DetailItem>
                    </Col>
                  </Row>
                </DetailSection>
              </>
            )}

            <Divider />
            <DetailSection
              title="检查清单"
              actions={
                canManageRoom && (
                  <Button
                    type="primary"
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={() => {
                      checklistForm.resetFields();
                      setChecklistModalOpen(true);
                    }}
                  >
                    新建检查
                  </Button>
                )
              }
            >
              <Spin spinning={checklistLoading}>
                {checklists.length === 0 ? (
                  <EmptyState
                    title="暂无检查清单"
                    description="入住或退租时可创建检查清单"
                  />
                ) : (
                  <Table
                    rowKey="id"
                    dataSource={checklists}
                    pagination={false}
                    size="small"
                    columns={[
                      {
                        title: '类型',
                        dataIndex: 'checkType',
                        render: (v: string) =>
                          v === 'CHECKIN' ? '入住检查' : '退租检查',
                      },
                      { title: '检查日期', dataIndex: 'checkDate' },
                      {
                        title: '检查项数',
                        render: (_: unknown, r: RoomChecklist) =>
                          r.items?.length ?? 0,
                      },
                      {
                        title: '操作',
                        render: (_: unknown, r: RoomChecklist) => (
                          <Popconfirm
                            title="删除检查清单"
                            onConfirm={async () => {
                              if (!currentOrgId) return;
                              await deleteRoomChecklist(currentOrgId, r.id);
                              message.success('已删除');
                              loadChecklists();
                            }}
                          >
                            <Button size="small" danger>
                              删除
                            </Button>
                          </Popconfirm>
                        ),
                      },
                    ]}
                  />
                )}
              </Spin>
            </DetailSection>
          </>
        )}
      </Spin>

      <Modal
        title="新建检查清单"
        open={checklistModalOpen}
        onCancel={() => setChecklistModalOpen(false)}
        onOk={() => checklistForm.submit()}
      >
        <Form
          form={checklistForm}
          layout="vertical"
          onFinish={async (values) => {
            if (!currentOrgId || !id || !room) return;
            const active = room.leases?.find((l) => l.status === 'ACTIVE');
            await createRoomChecklist(currentOrgId, {
              leaseId: active?.id ?? id,
              roomId: id,
              checkType: values.checkType,
              checkDate: values.checkDate.toISOString(),
              note: values.note,
              items: values.items?.map((item: Record<string, unknown>) => ({
                category: item.category,
                itemName: item.itemName,
                status: item.status,
                description: item.description,
                deductionAmount: item.deductionAmount,
                note: item.note,
              })),
            });
            message.success('检查清单已创建');
            setChecklistModalOpen(false);
            checklistForm.resetFields();
            loadChecklists();
          }}
        >
          <Form.Item
            name="checkType"
            label="检查类型"
            rules={[{ required: true }]}
          >
            <Select
              options={[
                { value: 'CHECKIN', label: '入住检查' },
                { value: 'CHECKOUT', label: '退租检查' },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="checkDate"
            label="检查日期"
            rules={[{ required: true }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

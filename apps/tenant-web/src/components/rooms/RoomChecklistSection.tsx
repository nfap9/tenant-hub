// PAGE-114: 检查清单页面
import { useState, useEffect, useCallback } from 'react';
import {
  Button,
  Tag,
  Spin,
  message,
  Popconfirm,
  Row,
  Col,
  Table,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  Image,
  Space,
  Alert,
} from 'antd';
import { PlusOutlined, EyeOutlined, SwapOutlined } from '@ant-design/icons';
import {
  getRoomChecklists,
  createRoomChecklist,
  deleteRoomChecklist,
  type RoomChecklist,
} from '@/api/roomChecklists';
import { money } from '@/utils/format';
import EmptyState from '@/components/ui/EmptyState';
import DetailSection from '@/components/ui/DetailSection';

interface RoomChecklistSectionProps {
  roomId: string;
  currentOrgId: string;
  canManageRoom: boolean;
  activeLeaseId?: string;
}

export default function RoomChecklistSection({
  roomId,
  currentOrgId,
  canManageRoom,
  activeLeaseId,
}: RoomChecklistSectionProps) {
  const [checklists, setChecklists] = useState<RoomChecklist[]>([]);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [checklistModalOpen, setChecklistModalOpen] = useState(false);
  const [checklistForm] = Form.useForm();
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailChecklist, setDetailChecklist] = useState<RoomChecklist | null>(
    null
  );
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [compareChecklists, setCompareChecklists] = useState<{
    checkin: RoomChecklist | null;
    checkout: RoomChecklist | null;
  }>({ checkin: null, checkout: null });

  const loadChecklists = useCallback(async () => {
    setChecklistLoading(true);
    try {
      const data = await getRoomChecklists(currentOrgId, { roomId });
      setChecklists(data);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载检查清单失败');
    } finally {
      setChecklistLoading(false);
    }
  }, [currentOrgId, roomId]);

  useEffect(() => {
    loadChecklists();
  }, [loadChecklists]);

  const handleCreate = async (values: Record<string, unknown>) => {
    await createRoomChecklist(currentOrgId, {
      leaseId: activeLeaseId ?? roomId,
      roomId,
      checkType: values.checkType as 'CHECKIN' | 'CHECKOUT',
      checkDate: (
        values.checkDate as { toISOString: () => string }
      ).toISOString(),
      note: values.note as string | undefined,
      items: (values.items as Record<string, unknown>[])?.map((item) => ({
        category: item.category as string,
        itemName: item.itemName as string,
        status: item.status as string,
        description: item.description as string | undefined,
        photoUrl: item.photoUrl as string | undefined,
        deductionAmount: item.deductionAmount as string | number | undefined,
        note: item.note as string | undefined,
      })) as RoomChecklist['items'],
    });
    message.success('检查清单已创建');
    setChecklistModalOpen(false);
    checklistForm.resetFields();
    loadChecklists();
  };

  const handleDelete = async (checklistId: string) => {
    await deleteRoomChecklist(currentOrgId, checklistId);
    message.success('已删除');
    loadChecklists();
  };

  const checkinCount = checklists.filter(
    (c) => c.checkType === 'CHECKIN'
  ).length;
  const checkoutCount = checklists.filter(
    (c) => c.checkType === 'CHECKOUT'
  ).length;

  return (
    <>
      <DetailSection
        title="检查清单"
        actions={
          <Space>
            {checkinCount > 0 && checkoutCount > 0 && (
              <Button
                size="small"
                icon={<SwapOutlined />}
                onClick={() => {
                  const checkin =
                    checklists.find((c) => c.checkType === 'CHECKIN') || null;
                  const checkout =
                    checklists.find((c) => c.checkType === 'CHECKOUT') || null;
                  setCompareChecklists({ checkin, checkout });
                  setCompareModalOpen(true);
                }}
              >
                对比视图
              </Button>
            )}
            {canManageRoom && (
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
            )}
          </Space>
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
                    <Space>
                      <Button
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => {
                          setDetailChecklist(r);
                          setDetailModalOpen(true);
                        }}
                      >
                        查看
                      </Button>
                      <Popconfirm
                        title="删除检查清单"
                        onConfirm={() => handleDelete(r.id)}
                      >
                        <Button size="small" danger>
                          删除
                        </Button>
                      </Popconfirm>
                    </Space>
                  ),
                },
              ]}
            />
          )}
        </Spin>
      </DetailSection>

      {/* 新建检查清单 */}
      <Modal
        title="新建检查清单"
        open={checklistModalOpen}
        onCancel={() => setChecklistModalOpen(false)}
        onOk={() => checklistForm.submit()}
      >
        <Form form={checklistForm} layout="vertical" onFinish={handleCreate}>
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

      {/* 检查清单详情 */}
      <Modal
        title={`${
          detailChecklist?.checkType === 'CHECKIN' ? '入住检查' : '退租检查'
        }详情 (${detailChecklist?.checkDate ?? ''})`}
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={null}
        width={720}
      >
        {detailChecklist && (
          <div>
            {detailChecklist.note && (
              <Alert
                message={detailChecklist.note}
                type="info"
                style={{ marginBottom: 16 }}
              />
            )}
            {(detailChecklist.tenantSignUrl ||
              detailChecklist.operatorSignUrl) && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 500, marginBottom: 8 }}>签名照片</div>
                <Row gutter={16}>
                  {detailChecklist.tenantSignUrl && (
                    <Col span={12}>
                      <div
                        style={{
                          fontSize: 12,
                          color: '#666',
                          marginBottom: 4,
                        }}
                      >
                        租客签名
                      </div>
                      <Image
                        src={detailChecklist.tenantSignUrl}
                        alt="租客签名"
                        style={{
                          width: '100%',
                          maxHeight: 160,
                          objectFit: 'contain',
                        }}
                      />
                    </Col>
                  )}
                  {detailChecklist.operatorSignUrl && (
                    <Col span={12}>
                      <div
                        style={{
                          fontSize: 12,
                          color: '#666',
                          marginBottom: 4,
                        }}
                      >
                        经办人签名
                      </div>
                      <Image
                        src={detailChecklist.operatorSignUrl}
                        alt="经办人签名"
                        style={{
                          width: '100%',
                          maxHeight: 160,
                          objectFit: 'contain',
                        }}
                      />
                    </Col>
                  )}
                </Row>
              </div>
            )}
            <div style={{ fontWeight: 500, marginBottom: 8 }}>检查项</div>
            {detailChecklist.items && detailChecklist.items.length > 0 ? (
              <Table
                dataSource={detailChecklist.items}
                rowKey="id"
                pagination={false}
                size="small"
                columns={[
                  {
                    title: '分类',
                    dataIndex: 'category',
                    width: 100,
                  },
                  {
                    title: '项目',
                    dataIndex: 'itemName',
                    width: 140,
                  },
                  {
                    title: '状态',
                    dataIndex: 'status',
                    width: 80,
                    render: (v: string) => (
                      <Tag
                        color={
                          v === 'GOOD'
                            ? 'success'
                            : v === 'DAMAGED'
                              ? 'error'
                              : v === 'MISSING'
                                ? 'warning'
                                : 'default'
                        }
                      >
                        {v === 'GOOD'
                          ? '正常'
                          : v === 'DAMAGED'
                            ? '损坏'
                            : v === 'MISSING'
                              ? '缺失'
                              : v}
                      </Tag>
                    ),
                  },
                  {
                    title: '描述',
                    dataIndex: 'description',
                    render: (v?: string) => v || '-',
                  },
                  {
                    title: '照片',
                    dataIndex: 'photoUrl',
                    width: 80,
                    render: (v?: string) =>
                      v ? (
                        <Image
                          src={v}
                          alt="照片"
                          style={{
                            width: 48,
                            height: 48,
                            objectFit: 'cover',
                            borderRadius: 4,
                            cursor: 'pointer',
                          }}
                        />
                      ) : (
                        '-'
                      ),
                  },
                  {
                    title: '扣款',
                    dataIndex: 'deductionAmount',
                    width: 90,
                    render: (v?: string | number) => (v ? `¥${money(v)}` : '-'),
                  },
                ]}
              />
            ) : (
              <div style={{ color: '#999' }}>无检查项</div>
            )}
          </div>
        )}
      </Modal>

      {/* 入住退租对比视图 */}
      <Modal
        title="入住 / 退租 对比视图"
        open={compareModalOpen}
        onCancel={() => setCompareModalOpen(false)}
        footer={null}
        width={960}
      >
        {compareChecklists.checkin && compareChecklists.checkout && (
          <Row gutter={24}>
            <Col span={12}>
              <div style={{ fontWeight: 600, marginBottom: 12 }}>
                入住检查 ({compareChecklists.checkin.checkDate})
              </div>
              <Table
                dataSource={compareChecklists.checkin.items}
                rowKey="id"
                pagination={false}
                size="small"
                columns={[
                  {
                    title: '项目',
                    dataIndex: 'itemName',
                    width: 120,
                  },
                  {
                    title: '状态',
                    dataIndex: 'status',
                    width: 70,
                    render: (v: string) => (
                      <Tag
                        color={
                          v === 'GOOD'
                            ? 'success'
                            : v === 'DAMAGED'
                              ? 'error'
                              : v === 'MISSING'
                                ? 'warning'
                                : 'default'
                        }
                      >
                        {v === 'GOOD'
                          ? '正常'
                          : v === 'DAMAGED'
                            ? '损坏'
                            : v === 'MISSING'
                              ? '缺失'
                              : v}
                      </Tag>
                    ),
                  },
                  {
                    title: '照片',
                    dataIndex: 'photoUrl',
                    width: 60,
                    render: (v?: string) =>
                      v ? (
                        <Image
                          src={v}
                          alt="照片"
                          style={{
                            width: 40,
                            height: 40,
                            objectFit: 'cover',
                            borderRadius: 4,
                            cursor: 'pointer',
                          }}
                        />
                      ) : (
                        '-'
                      ),
                  },
                ]}
              />
            </Col>
            <Col span={12}>
              <div style={{ fontWeight: 600, marginBottom: 12 }}>
                退租检查 ({compareChecklists.checkout.checkDate})
              </div>
              <Table
                dataSource={compareChecklists.checkout.items}
                rowKey="id"
                pagination={false}
                size="small"
                columns={[
                  {
                    title: '项目',
                    dataIndex: 'itemName',
                    width: 120,
                  },
                  {
                    title: '状态',
                    dataIndex: 'status',
                    width: 70,
                    render: (v: string) => (
                      <Tag
                        color={
                          v === 'GOOD'
                            ? 'success'
                            : v === 'DAMAGED'
                              ? 'error'
                              : v === 'MISSING'
                                ? 'warning'
                                : 'default'
                        }
                      >
                        {v === 'GOOD'
                          ? '正常'
                          : v === 'DAMAGED'
                            ? '损坏'
                            : v === 'MISSING'
                              ? '缺失'
                              : v}
                      </Tag>
                    ),
                  },
                  {
                    title: '照片',
                    dataIndex: 'photoUrl',
                    width: 60,
                    render: (v?: string) =>
                      v ? (
                        <Image
                          src={v}
                          alt="照片"
                          style={{
                            width: 40,
                            height: 40,
                            objectFit: 'cover',
                            borderRadius: 4,
                            cursor: 'pointer',
                          }}
                        />
                      ) : (
                        '-'
                      ),
                  },
                ]}
              />
            </Col>
          </Row>
        )}
      </Modal>
    </>
  );
}

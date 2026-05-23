import { useState, useMemo, useEffect } from 'react';
import { Card, Form, InputNumber, Button, message, Checkbox } from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import { SaveOutlined, BuildOutlined, HomeOutlined } from '@ant-design/icons';
import { useAppSession, useHasPermission } from '@/context/AppSessionContext';
import { createRoomsBatch } from '@/api/rooms';
import {
  buildBatchRoomNos,
  groupBatchRoomNosByFloor,
  toggleBatchRoomSelection,
} from '@/utils/batchRooms';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import styles from './RoomBatchPage.module.scss';

export default function RoomBatchPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentOrgId } = useAppSession();
  const canManageRoom = useHasPermission('room:manage');
  Form.useForm();

  const [batchStartFloor, setBatchStartFloor] = useState('2');
  const [batchEndFloor, setBatchEndFloor] = useState('4');
  const [batchRoomCount, setBatchRoomCount] = useState('4');
  const [selectedBatchRoomNos, setSelectedBatchRoomNos] = useState<string[]>(
    []
  );
  const [saving, setSaving] = useState(false);

  const generatedBatchRoomNos = useMemo(
    () =>
      buildBatchRoomNos({
        startFloor: batchStartFloor,
        endFloor: batchEndFloor,
        roomCount: batchRoomCount,
      }),
    [batchStartFloor, batchEndFloor, batchRoomCount]
  );

  const selectedGeneratedBatchRoomNos = useMemo(
    () =>
      generatedBatchRoomNos.filter((roomNo) =>
        selectedBatchRoomNos.includes(roomNo)
      ),
    [generatedBatchRoomNos, selectedBatchRoomNos]
  );

  const batchRoomGroups = useMemo(
    () => groupBatchRoomNosByFloor(generatedBatchRoomNos),
    [generatedBatchRoomNos]
  );

  useEffect(() => {
    setSelectedBatchRoomNos(generatedBatchRoomNos);
  }, [generatedBatchRoomNos]);

  const handleSave = async () => {
    if (!currentOrgId || !id) return;
    if (!canManageRoom) {
      message.warning('当前角色没有管理房间权限');
      return;
    }
    if (selectedGeneratedBatchRoomNos.length === 0) {
      message.warning('请至少选择一个房间号');
      return;
    }

    setSaving(true);
    try {
      await createRoomsBatch(
        currentOrgId,
        id,
        selectedGeneratedBatchRoomNos.map((roomNo) => ({
          roomNo,
          layout: '未配置',
          facilities: [],
        }))
      );
      message.success(
        `已提交 ${selectedGeneratedBatchRoomNos.length} 间房间，重复房间会自动跳过`
      );
      navigate(`/apartments/${id}`);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '批量添加房间失败');
    } finally {
      setSaving(false);
    }
  };

  const allSelected =
    selectedGeneratedBatchRoomNos.length === generatedBatchRoomNos.length &&
    generatedBatchRoomNos.length > 0;

  return (
    <div className="page-content">
      <PageHeader
        back={`/apartments/${id}`}
        breadcrumb={[
          { label: '公寓管理', path: '/apartments' },
          { label: '公寓详情', path: `/apartments/${id}` },
          { label: '批量添加房间' },
        ]}
      />

      <Card className={styles.batchFormCard}>
        <Form layout="vertical">
          <div className={styles.formGrid3}>
            <Form.Item label="开始楼层">
              <InputNumber
                min={1}
                size="large"
                className="w-full"
                prefix={<BuildOutlined className="text-subtle" />}
                value={Number(batchStartFloor) || undefined}
                onChange={(v) => setBatchStartFloor(String(v || 1))}
              />
            </Form.Item>
            <Form.Item label="结束楼层">
              <InputNumber
                min={1}
                size="large"
                className="w-full"
                prefix={<BuildOutlined className="text-subtle" />}
                value={Number(batchEndFloor) || undefined}
                onChange={(v) => setBatchEndFloor(String(v || 1))}
              />
            </Form.Item>
            <Form.Item label="每层房间数">
              <InputNumber
                min={1}
                max={200}
                size="large"
                className="w-full"
                prefix={<HomeOutlined className="text-subtle" />}
                value={Number(batchRoomCount) || undefined}
                onChange={(v) => setBatchRoomCount(String(v || 1))}
              />
            </Form.Item>
          </div>
        </Form>

        <div className="mt-16">
          <div className={styles.previewHeader}>
            <span className={styles.previewTitle}>生成房间号</span>
            <span className="text-muted">
              已选 {selectedGeneratedBatchRoomNos.length}/
              {generatedBatchRoomNos.length}
              {generatedBatchRoomNos.length > 0 && (
                <Checkbox
                  className={styles.checkboxMl}
                  checked={allSelected}
                  onChange={(e) =>
                    setSelectedBatchRoomNos(
                      e.target.checked ? generatedBatchRoomNos : []
                    )
                  }
                >
                  全选
                </Checkbox>
              )}
            </span>
          </div>

          {generatedBatchRoomNos.length === 0 ? (
            <EmptyState
              title="等待生成房间号"
              description="输入有效的楼层范围和每层房间数后会自动生成房间号"
            />
          ) : (
            <div className={styles.groupsContainer}>
              {batchRoomGroups.map((group) => (
                <div key={group.floor}>
                  <div className={styles.floorLabel}>{group.floor}层</div>
                  <div className={styles.roomButtons}>
                    {group.roomNos.map((roomNo) => {
                      const selected = selectedBatchRoomNos.includes(roomNo);
                      return (
                        <Button
                          key={roomNo}
                          type={selected ? 'primary' : 'default'}
                          size="small"
                          className={styles.roomBtn}
                          onClick={() =>
                            setSelectedBatchRoomNos((old) =>
                              toggleBatchRoomSelection(old, roomNo)
                            )
                          }
                        >
                          {roomNo}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.actionsContainer}>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saving}
            disabled={saving || selectedGeneratedBatchRoomNos.length === 0}
            onClick={handleSave}
            size="large"
          >
            确认添加房间
          </Button>
          <Button
            size="large"
            className={styles.cancelBtn}
            onClick={() => navigate(`/apartments/${id}`)}
          >
            取消
          </Button>
        </div>
      </Card>
    </div>
  );
}

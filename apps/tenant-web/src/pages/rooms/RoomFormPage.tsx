import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Card,
  Form,
  Input,
  InputNumber,
  Select,
  Button,
  message,
  Spin,
  DatePicker,
} from 'antd';
import {
  SaveOutlined,
  HomeOutlined,
  BuildOutlined,
  NumberOutlined,
  AppstoreOutlined,
  CompassOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAppSession, useHasPermission } from '@/context/AppSessionContext';
import { getAllApartments } from '@/api/apartments';
import { createRoom, updateRoom } from '@/api/rooms';
import type { Apartment, Room } from '@/types/domain';
import { optionalNumber, toFacilityArray, optionalText } from '@/utils/format';
import {
  emptyRoomForm,
  roomStatuses,
  statusLabels,
  orientationOptions,
  decorationStatusOptions,
} from './constants';
import { roomLayoutOptions } from '@/pages/apartments/constants';
import PageHeader from '@/components/ui/PageHeader';
import styles from './RoomFormPage.module.scss';

export default function RoomFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentOrgId } = useAppSession();
  const canManageRoom = useHasPermission('room:manage');
  const isEdit = Boolean(id);
  const [form] = Form.useForm();

  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const initializedRef = useRef(false);

  const urlApartmentId = searchParams.get('apartmentId');

  useEffect(() => {
    if (!currentOrgId) return;
    setLoading(true);
    getAllApartments(currentOrgId)
      .then((data) => {
        setApartments(data);
        const allRooms = data.flatMap((a) => a.rooms ?? []);
        setRooms(allRooms);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [currentOrgId]);

  const editingRoom = useMemo(() => {
    if (!id) return undefined;
    return rooms.find((r) => r.id === id);
  }, [rooms, id]);

  useEffect(() => {
    if (isEdit && editingRoom && !initializedRef.current) {
      form.setFieldsValue({
        apartmentId: editingRoom.apartmentId,
        roomNo: editingRoom.roomNo,
        floor: editingRoom.floor,
        layout: editingRoom.layout,
        area: editingRoom.area ? Number(editingRoom.area) : undefined,
        orientation: editingRoom.orientation,
        decorationStatus: editingRoom.decorationStatus,
        decorationDate: editingRoom.decorationDate
          ? dayjs(editingRoom.decorationDate)
          : undefined,
        facilities: editingRoom.facilities?.join(',') ?? '',
        status: editingRoom.status,
      });
      initializedRef.current = true;
    }
    if (!isEdit) {
      form.setFieldsValue({
        apartmentId: urlApartmentId || undefined,
        ...emptyRoomForm,
      });
      initializedRef.current = false;
    }
  }, [isEdit, editingRoom, form, urlApartmentId]);

  const handleSubmit = async (values: Record<string, unknown>) => {
    if (!currentOrgId) return;
    if (!canManageRoom) {
      message.warning('当前角色没有管理房间权限');
      return;
    }
    if (!values.roomNo || !values.layout) {
      message.warning('请填写房间号和户型');
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        await updateRoom(currentOrgId, id!, {
          roomNo: String(values.roomNo).trim(),
          floor: optionalNumber(values.floor),
          layout: String(values.layout).trim(),
          area: optionalNumber(values.area),
          orientation: optionalText(values.orientation),
          decorationStatus: optionalText(values.decorationStatus),
          decorationDate: values.decorationDate
            ? dayjs(values.decorationDate as string).format('YYYY-MM-DD')
            : undefined,
          facilities: toFacilityArray(String(values.facilities)),
          status: String(values.status),
        });
        message.success('房间信息已更新');
        navigate('/rooms');
      } else {
        const apartmentId = String(values.apartmentId);
        if (!apartmentId) {
          message.warning('请选择所属公寓');
          return;
        }
        await createRoom(currentOrgId, apartmentId, {
          roomNo: String(values.roomNo).trim(),
          floor: optionalNumber(values.floor),
          layout: String(values.layout).trim(),
          area: optionalNumber(values.area),
          orientation: optionalText(values.orientation),
          decorationStatus: optionalText(values.decorationStatus),
          decorationDate: values.decorationDate
            ? dayjs(values.decorationDate as string).format('YYYY-MM-DD')
            : undefined,
          facilities: toFacilityArray(String(values.facilities)),
        });
        message.success('房间已添加');
        if (urlApartmentId) {
          navigate(`/apartments/${urlApartmentId}`);
        } else {
          navigate('/rooms');
        }
      }
    } catch (e) {
      message.error(
        e instanceof Error
          ? e.message
          : isEdit
            ? '更新房间失败'
            : '添加房间失败'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-content">
      <PageHeader
        back={
          isEdit
            ? '/rooms'
            : urlApartmentId
              ? `/apartments/${urlApartmentId}`
              : '/rooms'
        }
        breadcrumb={[
          { label: '房间管理', path: '/rooms' },
          { label: isEdit ? '编辑房间' : '新增房间' },
        ]}
      />

      <Spin spinning={loading}>
        <div className={styles.roomFormContainer}>
          <Card>
            <Form form={form} layout="vertical" onFinish={handleSubmit}>
              <Form.Item
                label="所属公寓"
                name="apartmentId"
                rules={[{ required: !isEdit, message: '请选择公寓' }]}
              >
                <Select
                  placeholder="请选择公寓"
                  disabled={isEdit}
                  options={apartments.map((a) => ({
                    label: a.name,
                    value: a.id,
                  }))}
                  prefix={<HomeOutlined className="text-subtle" />}
                />
              </Form.Item>
              <Form.Item
                label="房号"
                name="roomNo"
                rules={[{ required: true, message: '请输入房号' }]}
              >
                <Input
                  placeholder="例如 301"
                  prefix={<NumberOutlined className="text-subtle" />}
                />
              </Form.Item>
              <Form.Item
                label="户型"
                name="layout"
                rules={[{ required: true, message: '请选择户型' }]}
              >
                <Select
                  placeholder="请选择户型"
                  options={roomLayoutOptions.map((l) => ({
                    label: l,
                    value: l,
                  }))}
                  prefix={<BuildOutlined className="text-subtle" />}
                />
              </Form.Item>
              <div className={styles.formRow}>
                <Form.Item label="楼层" name="floor">
                  <InputNumber
                    min={1}
                    className="w-full"
                    placeholder="例如 3"
                  />
                </Form.Item>
                <Form.Item label="面积（㎡）" name="area">
                  <InputNumber
                    min={0}
                    className="w-full"
                    placeholder="请输入面积"
                  />
                </Form.Item>
              </div>
              <div className={styles.formRow}>
                <Form.Item label="朝向" name="orientation">
                  <Select
                    placeholder="请选择朝向"
                    options={orientationOptions}
                    allowClear
                    prefix={<CompassOutlined className="text-subtle" />}
                  />
                </Form.Item>
                <Form.Item label="装修标准" name="decorationStatus">
                  <Select
                    placeholder="请选择装修标准"
                    options={decorationStatusOptions}
                    allowClear
                  />
                </Form.Item>
              </div>
              <Form.Item label="装修日期" name="decorationDate">
                <DatePicker
                  className="w-full"
                  placeholder="请选择装修日期"
                  prefix={<CalendarOutlined className="text-subtle" />}
                />
              </Form.Item>
              {isEdit && (
                <Form.Item
                  label="状态"
                  name="status"
                  rules={[{ required: true }]}
                >
                  <Select
                    options={roomStatuses.map((s) => ({
                      label: statusLabels[s],
                      value: s,
                    }))}
                  />
                </Form.Item>
              )}
              <Form.Item label="设施" name="facilities">
                <Input
                  placeholder="多个设施用逗号分隔，如：空调,热水器,洗衣机"
                  prefix={<AppstoreOutlined className="text-subtle" />}
                />
              </Form.Item>
              <Form.Item className={styles.formActions}>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<SaveOutlined />}
                  loading={saving}
                  disabled={saving}
                >
                  {isEdit ? '保存修改' : '保存房间'}
                </Button>
                <Button
                  className={styles.cancelBtn}
                  onClick={() =>
                    navigate(
                      isEdit
                        ? '/rooms'
                        : urlApartmentId
                          ? `/apartments/${urlApartmentId}`
                          : '/rooms'
                    )
                  }
                >
                  取消
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </div>
      </Spin>
    </div>
  );
}

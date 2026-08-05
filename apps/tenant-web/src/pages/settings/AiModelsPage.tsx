import { useCallback, useEffect, useState } from 'react';
import type { Rule } from 'antd/es/form';
import {
  Button,
  Divider,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
} from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import { useAppSession } from '@/context/AppSessionContext';
import {
  listManagedAiModels,
  createAiModel,
  updateAiModel,
  deleteAiModel,
  type AiModelProvider,
  type ManagedAiModel,
} from '@/api/aiModels';
import { PERMISSIONS, hasPermission } from '@/utils/permissions';
import { requiredRule, nameRule } from '@/utils/validators';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import styles from './AiModelsPage.module.scss';

const PROVIDER_OPTIONS: { value: AiModelProvider; label: string }[] = [
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'openai-compat', label: 'OpenAI 兼容' },
];

const PROVIDER_TAG_COLORS: Record<AiModelProvider, string> = {
  anthropic: 'purple',
  openai: 'blue',
  'openai-compat': 'cyan',
};

type ModelFormValues = {
  id: string;
  displayName: string;
  provider: AiModelProvider;
  providerModel: string;
  baseURL?: string;
  apiKey?: string;
  maxTokens: number;
  contextWindowTokens: number;
  temperature: number;
  tags?: string[];
  costInput?: number | null;
  costOutput?: number | null;
  fallbackTo?: string[];
  authHeader?: string;
  enabled: boolean;
};

export default function AiModelsPage() {
  const { currentMembership } = useAppSession();
  const [form] = Form.useForm<ModelFormValues>();

  const [models, setModels] = useState<ManagedAiModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<ManagedAiModel | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toggleLoading, setToggleLoading] = useState<Record<string, boolean>>(
    {}
  );
  const [deleteLoading, setDeleteLoading] = useState<Record<string, boolean>>(
    {}
  );

  const canManage = hasPermission(
    currentMembership?.role.permissions,
    PERMISSIONS.AI_MODEL_MANAGE
  );

  const providerValue = Form.useWatch('provider', form);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listManagedAiModels();
      setModels(data);
      setForbidden(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '加载失败';
      if (msg.includes('无模型管理权限')) {
        setForbidden(true);
      } else {
        message.error(msg);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canManage) {
      load();
    }
  }, [canManage, load]);

  if (!currentMembership) {
    return (
      <div className="page-content">
        <PageHeader breadcrumb={[{ label: 'AI 模型管理' }]} />
        <EmptyState description="尚未加入任何组织，请先在个人中心创建或加入组织" />
      </div>
    );
  }

  if (!canManage || forbidden) {
    return (
      <div className="page-content">
        <PageHeader breadcrumb={[{ label: 'AI 模型管理' }]} />
        <EmptyState
          title="无访问权限"
          description="需要「AI 模型管理」权限才能访问本页，请联系组织管理员"
        />
      </div>
    );
  }

  const handleCreateOpen = () => {
    setEditingModel(null);
    setModalOpen(true);
  };

  const handleEditOpen = (record: ManagedAiModel) => {
    setEditingModel(record);
    setModalOpen(true);
  };

  const handleToggleEnabled = async (
    record: ManagedAiModel,
    enabled: boolean
  ) => {
    setToggleLoading((prev) => ({ ...prev, [record.id]: true }));
    try {
      await updateAiModel(record.id, { enabled });
      message.success(
        enabled
          ? `已启用「${record.displayName}」`
          : `已禁用「${record.displayName}」`
      );
      await load();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '操作失败');
    } finally {
      setToggleLoading((prev) => ({ ...prev, [record.id]: false }));
    }
  };

  const handleDelete = async (record: ManagedAiModel) => {
    setDeleteLoading((prev) => ({ ...prev, [record.id]: true }));
    try {
      await deleteAiModel(record.id);
      message.success('模型已删除');
      await load();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '删除失败');
    } finally {
      setDeleteLoading((prev) => ({ ...prev, [record.id]: false }));
    }
  };

  const handleSubmit = async (values: ModelFormValues) => {
    setSubmitting(true);
    try {
      const costPerMtu =
        values.costInput != null && values.costOutput != null
          ? { input: values.costInput, output: values.costOutput }
          : undefined;
      const base = {
        displayName: values.displayName.trim(),
        provider: values.provider,
        providerModel: values.providerModel.trim(),
        baseURL: values.baseURL?.trim() || undefined,
        maxTokens: values.maxTokens,
        contextWindowTokens: values.contextWindowTokens,
        temperature: values.temperature,
        tags: values.tags ?? [],
        costPerMtu,
        fallbackTo: values.fallbackTo ?? [],
        authHeader: values.authHeader?.trim() || undefined,
        enabled: values.enabled,
      };
      const apiKey = values.apiKey?.trim();
      if (editingModel) {
        await updateAiModel(editingModel.id, {
          ...base,
          // apiKey 留空表示保持不变，仅在填写时提交
          ...(apiKey ? { apiKey } : {}),
        });
        message.success('模型已更新');
      } else {
        await createAiModel({
          id: values.id.trim(),
          ...base,
          ...(apiKey ? { apiKey } : {}),
        });
        message.success('模型已创建');
      }
      setModalOpen(false);
      setEditingModel(null);
      await load();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  const fallbackOptions = models
    .filter((m) => m.id !== editingModel?.id)
    .map((m) => ({ value: m.id, label: `${m.displayName}（${m.id}）` }));

  const initialValues: Partial<ModelFormValues> = editingModel
    ? {
        id: editingModel.id,
        displayName: editingModel.displayName,
        provider: editingModel.provider,
        providerModel: editingModel.providerModel,
        baseURL: editingModel.baseURL ?? undefined,
        maxTokens: editingModel.maxTokens,
        contextWindowTokens: editingModel.contextWindowTokens,
        temperature: editingModel.temperature,
        tags: editingModel.tags,
        costInput: editingModel.costPerMtu?.input,
        costOutput: editingModel.costPerMtu?.output,
        fallbackTo: editingModel.fallbackTo,
        authHeader: editingModel.authHeader ?? undefined,
        enabled: editingModel.enabled,
      }
    : {
        maxTokens: 4096,
        contextWindowTokens: 128000,
        temperature: 0.3,
        tags: ['chat'],
        fallbackTo: [],
        enabled: true,
      };

  const columns = [
    {
      title: '模型',
      key: 'model',
      render: (_: unknown, record: ManagedAiModel) => (
        <div>
          <div className={styles.modelName}>{record.displayName}</div>
          <div className={styles.modelId}>{record.id}</div>
        </div>
      ),
    },
    {
      title: 'Provider',
      dataIndex: 'provider',
      key: 'provider',
      render: (provider: AiModelProvider) => (
        <Tag color={PROVIDER_TAG_COLORS[provider] ?? 'default'}>{provider}</Tag>
      ),
    },
    {
      title: '模型名',
      dataIndex: 'providerModel',
      key: 'providerModel',
      render: (text: string) => (
        <span className={styles.providerModel}>{text}</span>
      ),
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      render: (tags: string[]) =>
        tags.length > 0 ? (
          <Space size="small" wrap>
            {tags.map((t) => (
              <Tag key={t}>{t}</Tag>
            ))}
          </Space>
        ) : (
          '-'
        ),
    },
    {
      title: '降级链',
      dataIndex: 'fallbackTo',
      key: 'fallbackTo',
      render: (fallbackTo: string[]) =>
        fallbackTo.length > 0 ? (
          <span className={styles.fallbackChain}>{fallbackTo.join(' → ')}</span>
        ) : (
          '-'
        ),
    },
    {
      title: '密钥',
      dataIndex: 'hasApiKey',
      key: 'hasApiKey',
      render: (hasApiKey: boolean) =>
        hasApiKey ? <Tag color="success">已配置密钥</Tag> : <Tag>未配置</Tag>,
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (enabled: boolean, record: ManagedAiModel) => (
        <Switch
          checked={enabled}
          loading={toggleLoading[record.id]}
          onChange={(checked) => handleToggleEnabled(record, checked)}
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right' as const,
      render: (_: unknown, record: ManagedAiModel) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEditOpen(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="删除模型"
            description={`确认删除模型「${record.displayName}」？删除后不可恢复。`}
            okText="确认删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            onConfirm={() => handleDelete(record)}
          >
            <Button
              type="link"
              danger
              size="small"
              icon={<DeleteOutlined />}
              loading={deleteLoading[record.id]}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="page-content">
      <PageHeader
        breadcrumb={[{ label: 'AI 模型管理' }]}
        actions={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreateOpen}
          >
            新增模型
          </Button>
        }
      />

      {!loading && models.length === 0 ? (
        <EmptyState
          title="暂无模型"
          description="还没有配置任何 AI 模型，新增后即可在组织设置中选用"
          action={{ label: '新增模型', onClick: handleCreateOpen }}
        />
      ) : (
        <Table
          dataSource={models}
          columns={columns}
          rowKey={(record) => record.id}
          loading={loading}
          pagination={false}
          scroll={{ x: 'max-content' }}
        />
      )}

      <Modal
        title={editingModel ? '编辑模型' : '新增模型'}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setEditingModel(null);
        }}
        footer={null}
        width={720}
        destroyOnClose
      >
        <Form
          key={editingModel?.id ?? 'create'}
          form={form}
          layout="vertical"
          preserve={false}
          initialValues={initialValues}
          onFinish={handleSubmit}
        >
          <div className={styles.formRow}>
            <Form.Item
              label="模型 ID"
              name="id"
              rules={[
                requiredRule('请输入模型 ID'),
                { max: 64, message: '模型 ID 不能超过 64 个字符' },
              ]}
              extra={editingModel ? '模型 ID 创建后不可修改' : undefined}
            >
              <Input
                placeholder="例如：claude-sonnet"
                disabled={Boolean(editingModel)}
              />
            </Form.Item>
            <Form.Item
              label="显示名称"
              name="displayName"
              rules={nameRule('显示名称')}
            >
              <Input placeholder="例如：Claude Sonnet" maxLength={64} />
            </Form.Item>
          </div>
          <div className={styles.formRow}>
            <Form.Item
              label="Provider"
              name="provider"
              rules={[requiredRule('请选择 Provider')]}
            >
              <Select options={PROVIDER_OPTIONS} placeholder="请选择" />
            </Form.Item>
            <Form.Item
              label="供应商模型名"
              name="providerModel"
              rules={[requiredRule('请输入供应商模型名')]}
            >
              <Input placeholder="例如：claude-sonnet-4-5" />
            </Form.Item>
          </div>
          <Form.Item label="Base URL" name="baseURL">
            <Input placeholder="可选，自定义 API 地址" />
          </Form.Item>
          <Form.Item
            label="API Key"
            name="apiKey"
            extra={
              editingModel
                ? editingModel.hasApiKey
                  ? '已配置密钥，留空表示保持不变'
                  : '未配置密钥，留空则不设置'
                : '模型调用所需密钥；本地无密钥服务（如 Ollama）可填任意占位串'
            }
          >
            <Input.Password
              placeholder={editingModel ? '留空表示保持不变' : '请输入 API Key'}
              autoComplete="new-password"
            />
          </Form.Item>

          <Divider orientation="left">高级配置</Divider>

          <div className={styles.formRow}>
            <Form.Item
              label="最大输出 Token"
              name="maxTokens"
              rules={[requiredRule('请输入最大输出 Token')]}
            >
              <InputNumber min={1} precision={0} className={styles.fullWidth} />
            </Form.Item>
            <Form.Item
              label="上下文窗口 Token"
              name="contextWindowTokens"
              rules={[requiredRule('请输入上下文窗口 Token')]}
            >
              <InputNumber min={1} precision={0} className={styles.fullWidth} />
            </Form.Item>
          </div>
          <div className={styles.formRow}>
            <Form.Item
              label="Temperature"
              name="temperature"
              rules={[requiredRule('请输入 Temperature')]}
            >
              <InputNumber
                min={0}
                max={2}
                step={0.1}
                className={styles.fullWidth}
              />
            </Form.Item>
            <Form.Item
              label="认证字段名"
              name="authHeader"
              extra="可选，自定义认证请求头名"
            >
              <Input
                placeholder={
                  providerValue === 'anthropic'
                    ? '默认 x-api-key'
                    : '默认 Authorization'
                }
              />
            </Form.Item>
          </div>
          <div className={styles.formRow}>
            <Form.Item
              label="输入成本（$/1M tokens）"
              name="costInput"
              dependencies={['costOutput']}
              rules={[costPairRule('costOutput')]}
            >
              <InputNumber
                min={0}
                step={0.01}
                className={styles.fullWidth}
                placeholder="可选"
              />
            </Form.Item>
            <Form.Item
              label="输出成本（$/1M tokens）"
              name="costOutput"
              dependencies={['costInput']}
              rules={[costPairRule('costInput')]}
            >
              <InputNumber
                min={0}
                step={0.01}
                className={styles.fullWidth}
                placeholder="可选"
              />
            </Form.Item>
          </div>
          <Form.Item label="标签" name="tags">
            <Select mode="tags" placeholder="例如：chat" open={false} />
          </Form.Item>
          <Form.Item
            label="降级模型链"
            name="fallbackTo"
            extra="调用失败时依次尝试的降级模型，按选择顺序生效"
          >
            <Select
              mode="multiple"
              options={fallbackOptions}
              placeholder="可选，选择其他模型作为降级"
            />
          </Form.Item>
          <Form.Item label="启用" name="enabled" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={submitting}
              icon={<SaveOutlined />}
            >
              保存
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

/** 输入/输出成本必须成对填写或整组留空 */
const costPairRule =
  (otherField: 'costInput' | 'costOutput'): Rule =>
  ({ getFieldValue }) => ({
    validator(_, value) {
      const filled = value != null;
      const otherFilled = getFieldValue(otherField) != null;
      if (filled === otherFilled) {
        return Promise.resolve();
      }
      return Promise.reject(new Error('输入/输出成本需成对填写，或整组留空'));
    },
  });

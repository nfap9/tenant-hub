import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Upload, Button, message } from 'antd';
import {
  UploadOutlined,
  ImportOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { useAppSession } from '@/context/AppSessionContext';
import { importUtilityCsv } from '@/api/bills';
import PageHeader from '@/components/ui/PageHeader';
import styles from './UtilityImportPage.module.scss';

export default function UtilityImportPage() {
  const { currentOrgId } = useAppSession();
  const navigate = useNavigate();
  const [fileContent, setFileContent] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const handleUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setFileContent(text);
    };
    reader.readAsText(file);
    return false;
  };

  const handleSubmit = async () => {
    if (!currentOrgId || !fileContent.trim()) {
      message.error('请先上传 CSV 文件');
      return;
    }
    setSubmitting(true);
    try {
      const result = await importUtilityCsv(currentOrgId, fileContent);
      message.success(`导入成功，共 ${result.count} 条记录`);
      navigate('/bills');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '导入失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-content">
      <PageHeader
        back={true}
        breadcrumb={[
          { label: '财务管理', path: '/bills' },
          { label: '批量导入水电' },
        ]}
      />

      <Card>
        <Upload.Dragger beforeUpload={handleUpload} maxCount={1} accept=".csv">
          <p>
            <UploadOutlined className={styles.importUploadIcon} />
          </p>
          <p className={styles.importUploadText}>
            点击或拖拽 CSV 文件到此区域上传
          </p>
          <p className="text-muted">支持 CSV 格式批量导入水电读数</p>
        </Upload.Dragger>

        {fileContent && (
          <div className={styles.importMt24}>
            <div className={styles.importSuccess}>
              <CheckCircleOutlined />
              文件已读取
            </div>
            <pre className={styles.importPre}>
              {fileContent.slice(0, 2000)}
              {fileContent.length > 2000 ? '...' : ''}
            </pre>
          </div>
        )}

        <Button
          type="primary"
          className={styles.importMt24}
          loading={submitting}
          onClick={handleSubmit}
          disabled={!fileContent}
          icon={<ImportOutlined />}
        >
          确认导入
        </Button>
      </Card>
    </div>
  );
}

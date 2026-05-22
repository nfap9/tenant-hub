import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  Upload,
  Button,
  message,
} from "antd";
import {
  ArrowLeftOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { useAppSession } from "@/context/AppSessionContext";
import { importUtilityCsv } from "@/api/bills";

export default function UtilityImportPage() {
  const { currentOrgId } = useAppSession();
  const navigate = useNavigate();
  const [fileContent, setFileContent] = useState<string>("");
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
      message.error("请先上传 CSV 文件");
      return;
    }
    setSubmitting(true);
    try {
      const result = await importUtilityCsv(currentOrgId, fileContent);
      message.success(`导入成功，共 ${result.count} 条记录`);
      navigate("/bills");
    } catch (e) {
      message.error(e instanceof Error ? e.message : "导入失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>批量导入水电</h2>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
          返回
        </Button>
      </div>

      <Card>
        <Upload.Dragger
          beforeUpload={handleUpload}
          maxCount={1}
          accept=".csv"
        >
          <p className="ant-upload-drag-icon">
            <UploadOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽 CSV 文件到此区域上传</p>
          <p className="ant-upload-hint">支持 CSV 格式批量导入水电读数</p>
        </Upload.Dragger>

        {fileContent && (
          <div style={{ marginTop: 16 }}>
            <div style={{ color: "#52c41a", marginBottom: 8 }}>文件已读取</div>
            <pre
              style={{
                background: "#f5f5f5",
                padding: 12,
                borderRadius: 4,
                maxHeight: 200,
                overflow: "auto",
                fontSize: 12,
              }}
            >
              {fileContent.slice(0, 2000)}
              {fileContent.length > 2000 ? "..." : ""}
            </pre>
          </div>
        )}

        <Button
          type="primary"
          style={{ marginTop: 16 }}
          loading={submitting}
          onClick={handleSubmit}
          disabled={!fileContent}
        >
          确认导入
        </Button>
      </Card>
    </div>
  );
}

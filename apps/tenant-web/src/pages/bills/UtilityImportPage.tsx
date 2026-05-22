import { Card, Upload, Button } from "antd";
import { UploadOutlined } from "@ant-design/icons";

export default function UtilityImportPage() {
  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>批量导入水电</h2>
      <Card>
        <Upload.Dragger>
          <p className="ant-upload-drag-icon">
            <UploadOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
          <p className="ant-upload-hint">支持 Excel 文件批量导入</p>
        </Upload.Dragger>
        <Button type="primary" style={{ marginTop: 16 }}>
          确认导入
        </Button>
      </Card>
    </div>
  );
}

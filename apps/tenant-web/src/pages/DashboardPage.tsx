import { Card, Row, Col, Statistic } from "antd";
import { ApartmentOutlined, FileTextOutlined, UserOutlined, WalletOutlined } from "@ant-design/icons";

export default function DashboardPage() {
  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>首页</h2>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="公寓总数" value={0} prefix={<ApartmentOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="房间总数" value={0} prefix={<UserOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="待收账单" value={0} prefix={<FileTextOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="本月收入" value={0} prefix={<WalletOutlined />} suffix="元" />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card title="待办事项">待实现</Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="收入概览">待实现</Card>
        </Col>
      </Row>
    </div>
  );
}

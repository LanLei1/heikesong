import { useEffect, useState } from 'react'
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  Typography,
  Button,
  Spin,
} from 'antd'
import {
  FileTextOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  UserOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { listTickets, listStatuses } from '../api'
import type { Ticket, Status } from '../types'

const { Title } = Typography

const priorityMap: Record<string, { color: string; text: string }> = {
  low: { color: 'default', text: '低' },
  medium: { color: 'processing', text: '中' },
  high: { color: 'warning', text: '高' },
  urgent: { color: 'error', text: '紧急' },
}

const Dashboard = () => {
  const navigate = useNavigate()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [statuses, setStatuses] = useState<Status[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    Promise.all([listTickets(), listStatuses()])
      .then(([t, s]) => {
        setTickets(t)
        setStatuses(s)
      })
      .finally(() => setLoading(false))
  }, [])

  const total = tickets.length
  const closedStatusIds = statuses
    .filter((s) => s.name === '已关闭' || s.name === '已解决')
    .map((s) => s.id)
  const openTickets = tickets.filter((t) => !t.status_id || !closedStatusIds.includes(t.status_id))
  const highPriorityTickets = tickets.filter((t) => t.priority === 'high' || t.priority === 'urgent')
  const unassignedTickets = tickets.filter((t) => t.assignee_id === null)

  const statusCounts = statuses.map((s) => ({
    ...s,
    count: tickets.filter((t) => t.status_id === s.id).length,
  }))

  const recentTickets = tickets.slice(0, 5)

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 60,
    },
    {
      title: '标题',
      dataIndex: 'title',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status_name',
      width: 100,
      render: (_: string, record: Ticket) => (
        <Tag color={record.status_color || 'default'}>{record.status_name || '-'}</Tag>
      ),
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 90,
      render: (priority: string) => {
        const p = priorityMap[priority] || { color: 'default', text: priority }
        return <Tag color={p.color}>{p.text}</Tag>
      },
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      width: 170,
    },
  ]

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 64 }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div>
      <Title className="page-title">首页看板</Title>

      <Row gutter={[16, 16]} style={{ marginBottom: 24, marginTop: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="工单总数"
              value={total}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="进行中/未关闭"
              value={openTickets.length}
              valueStyle={{ color: '#1677ff' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="高优先级"
              value={highPriorityTickets.length}
              valueStyle={{ color: '#cf1322' }}
              prefix={<ExclamationCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="未分配处理人"
              value={unassignedTickets.length}
              valueStyle={{ color: '#faad14' }}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="状态分布">
            <Row gutter={[8, 8]}>
              {statusCounts.map((s) => (
                <Col key={s.id} span={12}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 12px',
                      background: '#f6ffed',
                      borderRadius: 6,
                      borderLeft: `4px solid ${s.color}`,
                    }}
                  >
                    <Tag color={s.color}>{s.name}</Tag>
                    <span style={{ fontWeight: 600 }}>{s.count}</span>
                  </div>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            title="最近更新工单"
            extra={
              <Button type="link" onClick={() => navigate('/tickets')}>
                全部工单 <ArrowRightOutlined />
              </Button>
            }
          >
            <Table
              rowKey="id"
              columns={columns}
              dataSource={recentTickets}
              pagination={false}
              size="small"
              onRow={(record) => ({
                onClick: () => navigate(`/tickets/${record.id}/edit`),
                style: { cursor: 'pointer' },
              })}
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default Dashboard

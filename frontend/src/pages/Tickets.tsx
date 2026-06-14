import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Table,
  Button,
  Space,
  Tag,
  Input,
  Select,
  Modal,
  message,
  Popconfirm,
  Card,
  Typography,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons'
import { listTickets, updateTicket, deleteTicket, listStatuses, listUsers } from '../api'
import type { Ticket, Status, User } from '../types'

const { Search } = Input
const { Option } = Select

const priorityMap: Record<string, { color: string; text: string }> = {
  low: { color: 'default', text: '低' },
  medium: { color: 'processing', text: '中' },
  high: { color: 'warning', text: '高' },
  urgent: { color: 'error', text: '紧急' },
}

const Tickets = () => {
  const navigate = useNavigate()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [statuses, setStatuses] = useState<Status[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({
    keyword: '',
    status_id: undefined as number | undefined,
    priority: undefined as string | undefined,
    assignee_id: undefined as number | undefined,
  })

  const fetchData = async () => {
    setLoading(true)
    try {
      const [t, s, u] = await Promise.all([
        listTickets(filters),
        listStatuses(),
        listUsers(),
      ])
      setTickets(t)
      setStatuses(s)
      setUsers(u)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [filters])

  const handleDelete = async (id: number) => {
    await deleteTicket(id)
    message.success('删除成功')
    fetchData()
  }

  const handleStatusChange = async (ticket: Ticket, statusId: number) => {
    await updateTicket(ticket.id, { status_id: statusId })
    message.success('状态更新成功')
    fetchData()
  }

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 70,
    },
    {
      title: '标题',
      dataIndex: 'title',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status_id',
      width: 150,
      render: (statusId: number | null, record: Ticket) => (
        <Select
          size="small"
          style={{ width: 120 }}
          value={statusId ?? undefined}
          onChange={(value) => handleStatusChange(record, value)}
          onClick={(e) => e.stopPropagation()}
        >
          {statuses.map((s) => (
            <Option key={s.id} value={s.id}>
              <Tag color={s.color} style={{ marginRight: 0 }}>{s.name}</Tag>
            </Option>
          ))}
        </Select>
      ),
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 100,
      render: (priority: string) => {
        const p = priorityMap[priority] || { color: 'default', text: priority }
        return <Tag color={p.color}>{p.text}</Tag>
      },
    },
    {
      title: '创建人',
      dataIndex: 'creator_name',
      width: 120,
    },
    {
      title: '处理人',
      dataIndex: 'assignee_name',
      width: 120,
      render: (name: string | null) => name || '-',
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      width: 180,
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_: unknown, record: Ticket) => (
        <Space>
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => Modal.info({ title: record.title, content: record.description || '暂无描述' })}
          >
            查看
          </Button>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => navigate(`/tickets/${record.id}/edit`)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除该工单？"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button type="text" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div className="page-header">
        <Typography.Title className="page-title">工单管理</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/tickets/new')}>
          新建工单
        </Button>
      </div>

      <Card style={{ marginBottom: 24 }}>
        <Space wrap>
          <Search
            placeholder="搜索标题或描述"
            allowClear
            onSearch={(value) => setFilters((f) => ({ ...f, keyword: value }))}
            style={{ width: 260 }}
          />
          <Select
            placeholder="选择状态"
            allowClear
            style={{ width: 160 }}
            value={filters.status_id}
            onChange={(value) => setFilters((f) => ({ ...f, status_id: value }))}
          >
            {statuses.map((s) => (
              <Option key={s.id} value={s.id}>{s.name}</Option>
            ))}
          </Select>
          <Select
            placeholder="选择优先级"
            allowClear
            style={{ width: 160 }}
            value={filters.priority}
            onChange={(value) => setFilters((f) => ({ ...f, priority: value }))}
          >
            <Option value="low">低</Option>
            <Option value="medium">中</Option>
            <Option value="high">高</Option>
            <Option value="urgent">紧急</Option>
          </Select>
          <Select
            placeholder="选择处理人"
            allowClear
            style={{ width: 160 }}
            value={filters.assignee_id}
            onChange={(value) => setFilters((f) => ({ ...f, assignee_id: value }))}
          >
            {users.map((u) => (
              <Option key={u.id} value={u.id}>{u.username}</Option>
            ))}
          </Select>
        </Space>
      </Card>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={tickets}
        loading={loading}
        pagination={{ pageSize: 10 }}
      />
    </div>
  )
}

export default Tickets

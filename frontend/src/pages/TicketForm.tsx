import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Form,
  Input,
  Select,
  Button,
  Card,
  Typography,
  message,
  Spin,
  Timeline,
  Space,
} from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import {
  createTicket,
  getTicket,
  updateTicket,
  listStatuses,
  listUsers,
  getTicketHistory,
} from '../api'
import type { Status, User, TicketHistory } from '../types'

const { TextArea } = Input
const { Option } = Select

const priorityOptions = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
  { value: 'urgent', label: '紧急' },
]

const TicketForm = () => {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = Boolean(id)
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [statuses, setStatuses] = useState<Status[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [history, setHistory] = useState<TicketHistory[]>([])

  useEffect(() => {
    Promise.all([listStatuses(), listUsers()]).then(([s, u]) => {
      setStatuses(s)
      setUsers(u)
    })
  }, [])

  useEffect(() => {
    if (!isEdit || !id) return
    setLoading(true)
    Promise.all([getTicket(Number(id)), getTicketHistory(Number(id))])
      .then(([ticket, h]) => {
        form.setFieldsValue({
          title: ticket.title,
          description: ticket.description,
          status_id: ticket.status_id,
          priority: ticket.priority,
          assignee_id: ticket.assignee_id,
        })
        setHistory(h)
      })
      .finally(() => setLoading(false))
  }, [id, isEdit, form])

  const onFinish = async (values: Record<string, unknown>) => {
    setSubmitting(true)
    try {
      if (isEdit) {
        await updateTicket(Number(id), values)
        message.success('工单更新成功')
      } else {
        await createTicket(values)
        message.success('工单创建成功')
      }
      navigate('/tickets')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 64 }}>
        <Spin />
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/tickets')}>
          返回
        </Button>
        <Typography.Title className="page-title">
          {isEdit ? '编辑工单' : '新建工单'}
        </Typography.Title>
        <div />
      </div>

      <Card title="基本信息" style={{ marginBottom: 24 }}>
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{ priority: 'medium' }}
        >
          <Form.Item
            label="标题"
            name="title"
            rules={[{ required: true, message: '请输入工单标题' }]}
          >
            <Input placeholder="请输入工单标题" />
          </Form.Item>

          <Form.Item label="描述" name="description">
            <TextArea rows={4} placeholder="请输入工单描述" />
          </Form.Item>

          <Form.Item
            label="状态"
            name="status_id"
            rules={[{ required: true, message: '请选择状态' }]}
          >
            <Select placeholder="请选择状态">
              {statuses.map((s) => (
                <Option key={s.id} value={s.id}>{s.name}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item label="优先级" name="priority">
            <Select placeholder="请选择优先级">
              {priorityOptions.map((p) => (
                <Option key={p.value} value={p.value}>{p.label}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item label="处理人" name="assignee_id">
            <Select placeholder="请选择处理人" allowClear>
              {users.map((u) => (
                <Option key={u.id} value={u.id}>{u.username}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={submitting}>
                保存
              </Button>
              <Button onClick={() => navigate('/tickets')}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      {isEdit && history.length > 0 && (
        <Card title="状态流转记录">
          <Timeline
            items={history.map((h) => ({
              children: (
                <div>
                  <div>
                    <strong>{h.changed_by_name}</strong> 将 <strong>{h.field}</strong> 从{' '}
                    <Typography.Text type="secondary">{h.old_value || '-'}</Typography.Text> 改为{' '}
                    <Typography.Text type="success">{h.new_value || '-'}</Typography.Text>
                  </div>
                  <div style={{ color: '#999', fontSize: 12 }}>{h.changed_at}</div>
                </div>
              ),
            }))}
          />
        </Card>
      )}
    </div>
  )
}

export default TicketForm

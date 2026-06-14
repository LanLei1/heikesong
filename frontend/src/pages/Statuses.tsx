import { useEffect, useState } from 'react'
import {
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  ColorPicker,
  InputNumber,
  message,
  Popconfirm,
  Typography,
  Select,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import {
  listStatuses,
  createStatus,
  updateStatus,
  deleteStatus,
  listTransitions,
  createTransition,
  deleteTransition,
} from '../api'
import type { Status, Transition } from '../types'

const { Option } = Select

const Statuses = () => {
  const [statuses, setStatuses] = useState<Status[]>([])
  const [transitions, setTransitions] = useState<Transition[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingStatus, setEditingStatus] = useState<Status | null>(null)
  const [form] = Form.useForm()
  const [transitionModalVisible, setTransitionModalVisible] = useState(false)
  const [transitionForm] = Form.useForm()

  const fetchData = async () => {
    setLoading(true)
    try {
      const [s, t] = await Promise.all([listStatuses(), listTransitions()])
      setStatuses(s)
      setTransitions(t)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const openModal = (status?: Status) => {
    setEditingStatus(status || null)
    if (status) {
      form.setFieldsValue({
        name: status.name,
        color: status.color,
        sort_order: status.sort_order,
      })
    } else {
      form.resetFields()
    }
    setModalVisible(true)
  }

  const handleSubmit = async (values: Record<string, unknown>) => {
    const payload = {
      ...values,
      color: typeof values.color === 'string' ? values.color : (values.color as { toHexString: () => string }).toHexString(),
    }
    if (editingStatus) {
      await updateStatus(editingStatus.id, payload)
      message.success('状态更新成功')
    } else {
      await createStatus(payload)
      message.success('状态创建成功')
    }
    setModalVisible(false)
    fetchData()
  }

  const handleDelete = async (id: number) => {
    await deleteStatus(id)
    message.success('删除成功')
    fetchData()
  }

  const handleAddTransition = async (values: { from_status_id?: number; to_status_id: number }) => {
    await createTransition({
      from_status_id: values.from_status_id ?? null,
      to_status_id: values.to_status_id,
    })
    message.success('流转规则添加成功')
    setTransitionModalVisible(false)
    transitionForm.resetFields()
    fetchData()
  }

  const handleDeleteTransition = async (id: number) => {
    await deleteTransition(id)
    message.success('删除成功')
    fetchData()
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 70 },
    {
      title: '名称',
      dataIndex: 'name',
      render: (name: string, record: Status) => (
        <Tag color={record.color}>{name}</Tag>
      ),
    },
    { title: '排序', dataIndex: 'sort_order', width: 90 },
    {
      title: '默认',
      dataIndex: 'is_default',
      width: 90,
      render: (v: boolean) => (v ? <Tag color="green">是</Tag> : '否'),
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_: unknown, record: Status) => (
        <Space>
          <Button type="text" icon={<EditOutlined />} onClick={() => openModal(record)}>编辑</Button>
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record.id)}>
            <Button type="text" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div className="page-header">
        <Typography.Title className="page-title">状态管理</Typography.Title>
        <Space>
          <Button onClick={() => setTransitionModalVisible(true)}>配置流转规则</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
            新增状态
          </Button>
        </Space>
      </div>

      <Table rowKey="id" columns={columns} dataSource={statuses} loading={loading} />

      <Modal
        title={editingStatus ? '编辑状态' : '新增状态'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item label="名称" name="name" rules={[{ required: true, message: '请输入状态名称' }]}>
            <Input placeholder="请输入状态名称" />
          </Form.Item>
          <Form.Item label="颜色" name="color" initialValue="#1677ff">
            <ColorPicker showText />
          </Form.Item>
          <Form.Item label="排序" name="sort_order" initialValue={0}>
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="配置状态流转规则"
        open={transitionModalVisible}
        onCancel={() => setTransitionModalVisible(false)}
        footer={null}
        width={720}
        destroyOnClose
      >
        <Form form={transitionForm} layout="inline" onFinish={handleAddTransition} style={{ marginBottom: 16 }}>
          <Form.Item name="from_status_id" style={{ width: 200 }}>
            <Select placeholder="来源状态（空表示任意）" allowClear>
              {statuses.map((s) => (
                <Option key={s.id} value={s.id}>{s.name}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="to_status_id" rules={[{ required: true, message: '请选择目标状态' }]} style={{ width: 200 }}>
            <Select placeholder="目标状态">
              {statuses.map((s) => (
                <Option key={s.id} value={s.id}>{s.name}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">添加</Button>
          </Form.Item>
        </Form>

        <Table
          rowKey="id"
          size="small"
          pagination={false}
          dataSource={transitions}
          columns={[
            {
              title: '来源状态',
              dataIndex: 'from_name',
              render: (name: string | null) => name || '任意状态',
            },
            {
              title: '目标状态',
              dataIndex: 'to_name',
            },
            {
              title: '操作',
              width: 100,
              render: (_: unknown, record: Transition) => (
                <Popconfirm title="确认删除？" onConfirm={() => handleDeleteTransition(record.id)}>
                  <Button type="text" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              ),
            },
          ]}
        />
      </Modal>
    </div>
  )
}

export default Statuses

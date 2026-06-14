import { useEffect, useState } from 'react'
import {
  Table,
  Card,
  Typography,
  Tag,
  Input,
  Select,
  Space,
  Pagination,
  message,
} from 'antd'
import { listLogs } from '../api'
import type { OperationLog } from '../types'

const { Title } = Typography
const { Search } = Input
const { Option } = Select

const actionMap: Record<string, { color: string; text: string }> = {
  login: { color: 'green', text: '登录' },
  logout: { color: 'default', text: '退出登录' },
  ticket_create: { color: 'blue', text: '创建工单' },
  ticket_update: { color: 'processing', text: '更新工单' },
  ticket_delete: { color: 'red', text: '删除工单' },
  status_create: { color: 'blue', text: '创建状态' },
  status_update: { color: 'processing', text: '更新状态' },
  status_delete: { color: 'red', text: '删除状态' },
  transition_create: { color: 'blue', text: '添加流转' },
  transition_delete: { color: 'red', text: '删除流转' },
  user_create: { color: 'blue', text: '创建用户' },
  user_update: { color: 'processing', text: '更新用户' },
  user_delete: { color: 'red', text: '删除用户' },
  permission_update: { color: 'warning', text: '权限配置' },
}

const Logs = () => {
  const [logs, setLogs] = useState<OperationLog[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [keyword, setKeyword] = useState('')
  const [action, setAction] = useState<string | undefined>(undefined)

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const result = await listLogs({
        page,
        page_size: pageSize,
        keyword: keyword || undefined,
        action: action || undefined,
      })
      setLogs(result.items)
      setTotal(result.total)
    } catch {
      message.error('获取操作日志失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [page, pageSize, action, keyword])

  const handleSearch = (value: string) => {
    setKeyword(value)
    setPage(1)
  }

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 70,
    },
    {
      title: '操作人',
      dataIndex: 'username',
      width: 120,
      render: (name: string | null) => name || '系统',
    },
    {
      title: '操作类型',
      dataIndex: 'action',
      width: 120,
      render: (action: string) => {
        const info = actionMap[action] || { color: 'default', text: action }
        return <Tag color={info.color}>{info.text}</Tag>
      },
    },
    {
      title: '对象类型',
      dataIndex: 'target_type',
      width: 100,
      render: (v: string | null) => v || '-',
    },
    {
      title: '对象ID',
      dataIndex: 'target_id',
      width: 90,
      render: (v: number | null) => v ?? '-',
    },
    {
      title: '详情',
      dataIndex: 'detail',
      ellipsis: true,
      render: (v: string | null) => v || '-',
    },
    {
      title: 'IP',
      dataIndex: 'ip_address',
      width: 120,
      render: (v: string | null) => v || '-',
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      width: 180,
    },
  ]

  return (
    <div>
      <div className="page-header">
        <Title className="page-title">操作日志</Title>
      </div>

      <Card style={{ marginBottom: 24 }}>
        <Space wrap>
          <Search
            placeholder="搜索操作人、类型、详情"
            allowClear
            onSearch={handleSearch}
            style={{ width: 280 }}
          />
          <Select
            placeholder="操作类型"
            allowClear
            style={{ width: 160 }}
            value={action}
            onChange={(value) => {
              setAction(value)
              setPage(1)
            }}
          >
            {Object.entries(actionMap).map(([key, { text }]) => (
              <Option key={key} value={key}>{text}</Option>
            ))}
          </Select>
        </Space>
      </Card>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={logs}
        loading={loading}
        pagination={false}
      />

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
        <Pagination
          current={page}
          pageSize={pageSize}
          total={total}
          showSizeChanger
          onChange={(p, s) => {
            setPage(p)
            if (s) setPageSize(s)
          }}
        />
      </div>
    </div>
  )
}

export default Logs

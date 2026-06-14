import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Table, Button, Space, Tag, message, Popconfirm, Typography } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { listUsers, deleteUser, listRoles } from '../api'
import type { User, Role } from '../types'

const Users = () => {
  const navigate = useNavigate()
  const [users, setUsers] = useState<User[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [u, r] = await Promise.all([listUsers(), listRoles()])
      setUsers(u)
      setRoles(r)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleDelete = async (id: number) => {
    await deleteUser(id)
    message.success('删除成功')
    fetchData()
  }

  const getRoleName = (roleId: number | null) => {
    const role = roles.find((r) => r.id === roleId)
    return role?.name || '-'
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 70 },
    { title: '用户名', dataIndex: 'username' },
    {
      title: '角色',
      dataIndex: 'role_id',
      render: (roleId: number | null) => {
        const name = getRoleName(roleId)
        const label = name === 'super_admin' ? '超级管理员' : name === 'admin' ? '管理员' : '普通用户'
        const color = name === 'super_admin' ? 'red' : name === 'admin' ? 'blue' : 'default'
        return <Tag color={color}>{label}</Tag>
      },
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      width: 100,
      render: (v: boolean) => (v ? <Tag color="green">启用</Tag> : <Tag>禁用</Tag>),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 180,
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_: unknown, record: User) => (
        <Space>
          <Button type="text" icon={<EditOutlined />} onClick={() => navigate(`/users/${record.id}/edit`)}>编辑</Button>
          <Popconfirm title="确认删除该用户？" onConfirm={() => handleDelete(record.id)}>
            <Button type="text" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div className="page-header">
        <Typography.Title className="page-title">用户管理</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/users/new')}>
          新增用户
        </Button>
      </div>
      <Table rowKey="id" columns={columns} dataSource={users} loading={loading} pagination={{ pageSize: 10 }} />
    </div>
  )
}

export default Users

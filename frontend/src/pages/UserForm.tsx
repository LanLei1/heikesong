import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Form, Input, Select, Button, Card, Typography, message, Spin, Switch, Space } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { createUser, getUser, updateUser, listRoles } from '../api'
import type { Role } from '../types'

const { Option } = Select

const UserForm = () => {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = Boolean(id)
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [roles, setRoles] = useState<Role[]>([])

  useEffect(() => {
    listRoles().then(setRoles)
  }, [])

  useEffect(() => {
    if (!isEdit || !id) return
    setLoading(true)
    getUser(Number(id))
      .then((user) => {
        form.setFieldsValue({
          username: user.username,
          role_id: user.role_id,
          is_active: user.is_active,
        })
      })
      .finally(() => setLoading(false))
  }, [id, isEdit, form])

  const onFinish = async (values: Record<string, unknown>) => {
    setSubmitting(true)
    try {
      const payload = { ...values }
      if (!payload.password) {
        delete payload.password
      }
      if (isEdit) {
        await updateUser(Number(id), payload)
        message.success('用户更新成功')
      } else {
        await createUser(payload as { password: string })
        message.success('用户创建成功')
      }
      navigate('/users')
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
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/users')}>
          返回
        </Button>
        <Typography.Title className="page-title">
          {isEdit ? '编辑用户' : '新增用户'}
        </Typography.Title>
        <div />
      </div>

      <Card style={{ maxWidth: 600 }}>
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item
            label="用户名"
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder="请输入用户名" />
          </Form.Item>

          <Form.Item
            label="密码"
            name="password"
            rules={[
              {
                required: !isEdit,
                message: '请输入密码',
              },
              {
                min: 6,
                message: '密码长度不能少于6位',
              },
            ]}
          >
            <Input.Password placeholder={isEdit ? '不修改请留空' : '请输入密码'} />
          </Form.Item>

          <Form.Item label="角色" name="role_id" rules={[{ required: true, message: '请选择角色' }]}>
            <Select placeholder="请选择角色">
              {roles.map((r) => (
                <Option key={r.id} value={r.id}>
                  {r.name === 'super_admin' ? '超级管理员' : r.name === 'admin' ? '管理员' : '普通用户'}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item label="启用" name="is_active" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={submitting}>
                保存
              </Button>
              <Button onClick={() => navigate('/users')}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}

export default UserForm

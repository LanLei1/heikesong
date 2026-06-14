import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Input, Button, Card, Typography, message, Avatar, Space } from 'antd'
import { UserOutlined, LockOutlined, FileTextOutlined } from '@ant-design/icons'
import { login } from '../api'
import type { User } from '../types'

const { Title, Text } = Typography

interface LoginProps {
  onLogin: (user: User) => void
}

const Login = ({ onLogin }: LoginProps) => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true)
    try {
      const result = await login(values.username, values.password)
      localStorage.setItem('token', result.access_token)
      localStorage.setItem('user', JSON.stringify(result.user))
      onLogin(result.user)
      message.success('登录成功')
      navigate('/')
    } catch (error) {
      // 错误已在 api.ts 拦截器中提示，这里避免未捕获异常
      console.error('登录失败', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="login-page"
      style={{
        backgroundImage: 'url(/login-bg-with-logo.png)',
      }}
    >
      <Card className="login-box" bordered={false}>
        <Space direction="vertical" align="center" style={{ display: 'flex', marginBottom: 24 }}>
          <Avatar
            size={64}
            icon={<FileTextOutlined />}
            style={{
              background: 'linear-gradient(135deg, #1677ff 0%, #0958d9 100%)',
              boxShadow: '0 4px 12px rgba(22, 119, 255, 0.3)',
            }}
          />
          <Title level={3} className="login-title" style={{ margin: 0 }}>
            工单管理系统
          </Title>
          <Text type="secondary">Ticket Management System</Text>
        </Space>

        <Form
          name="login"
          size="large"
          onFinish={onFinish}
          autoComplete="off"
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="用户名"
              autoFocus
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="密码"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
            >
              登 录
            </Button>
          </Form.Item>
        </Form>
        <Typography.Text type="secondary" style={{ display: 'block', textAlign: 'center' }}>
          默认账号：admin / admin123
        </Typography.Text>
      </Card>
    </div>
  )
}

export default Login

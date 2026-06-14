import { useState } from 'react'
import {
  Layout as AntLayout,
  Menu,
  Button,
  Avatar,
  Space,
  Tag,
  Dropdown,
  type MenuProps,
} from 'antd'
import {
  DashboardOutlined,
  FileTextOutlined,
  TagsOutlined,
  TeamOutlined,
  SafetyOutlined,
  LogoutOutlined,
  UserOutlined,
  SettingOutlined,
  AuditOutlined,
} from '@ant-design/icons'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { logout } from '../api'
import type { User } from '../types'

const { Header, Sider, Content } = AntLayout

interface LayoutProps {
  user: User
  onLogout: () => void
}

const Layout = ({ user, onLogout }: LayoutProps) => {
  const location = useLocation()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)

  const isSuperAdmin = user.role_name === 'super_admin'
  const isAdmin = isSuperAdmin || user.role_name === 'admin'

  const settingsChildren: MenuProps['items'] = [
    {
      key: '/statuses',
      icon: <TagsOutlined />,
      label: '状态管理',
    },
  ]

  if (isAdmin) {
    settingsChildren.push(
      {
        key: '/users',
        icon: <TeamOutlined />,
        label: '用户管理',
      },
      {
        key: '/permissions',
        icon: <SafetyOutlined />,
        label: '权限管理',
      }
    )
  }

  if (isSuperAdmin) {
    settingsChildren.push({
      key: '/logs',
      icon: <AuditOutlined />,
      label: '操作日志',
    })
  }

  const items: MenuProps['items'] = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: '首页',
    },
    {
      key: '/tickets',
      icon: <FileTextOutlined />,
      label: '工单管理',
    },
    {
      key: '/settings',
      icon: <SettingOutlined />,
      label: '系统设置',
      children: settingsChildren,
    },
  ]

  const handleMenuClick = ({ key }: { key: string }) => {
    if (key === '/settings') return
    navigate(key)
  }

  const handleLogout = async () => {
    try {
      await logout()
    } catch {
      // 忽略网络错误，继续清理本地状态
    }
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    onLogout()
    navigate('/login')
  }

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ]

  return (
    <AntLayout className="app-layout">
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        theme="light"
        style={{
          boxShadow: '2px 0 8px rgba(0,0,0,0.06)',
          zIndex: 10,
        }}
      >
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          <span className="app-logo">{collapsed ? 'TS' : '工单系统'}</span>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={items}
          onClick={handleMenuClick}
          style={{ borderRight: 0 }}
        />
      </Sider>
      <AntLayout>
        <Header className="app-header">
          <Button
            type="text"
            onClick={() => setCollapsed(!collapsed)}
            style={{ fontSize: 16, width: 64, height: 64 }}
          >
            {collapsed ? '>>' : '<<'}
          </Button>
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <Space style={{ cursor: 'pointer' }}>
              <Tag color="blue">{user.role_name === 'super_admin' ? '超级管理员' : user.role_name === 'admin' ? '管理员' : '普通用户'}</Tag>
              <Avatar icon={<UserOutlined />} />
              <span>{user.username}</span>
            </Space>
          </Dropdown>
        </Header>
        <Content className="app-content">
          <Outlet />
        </Content>
      </AntLayout>
    </AntLayout>
  )
}

export default Layout

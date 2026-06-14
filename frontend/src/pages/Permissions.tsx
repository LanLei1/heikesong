import { useEffect, useState } from 'react'
import { Card, Select, Transfer, Button, message, Typography, Spin } from 'antd'
import { listRoles, listPermissions, getRolePermissions, setRolePermissions } from '../api'
import type { Role, Permission } from '../types'

const { Option } = Select

const Permissions = () => {
  const [roles, setRoles] = useState<Role[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [selectedRole, setSelectedRole] = useState<number | undefined>(undefined)
  const [targetKeys, setTargetKeys] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([listRoles(), listPermissions()]).then(([r, p]) => {
      setRoles(r)
      setPermissions(p)
    })
  }, [])

  useEffect(() => {
    if (!selectedRole) return
    setLoading(true)
    getRolePermissions(selectedRole)
      .then((p) => setTargetKeys(p.map((item) => String(item.id))))
      .finally(() => setLoading(false))
  }, [selectedRole])

  const handleSave = async () => {
    if (!selectedRole) return
    setSaving(true)
    try {
      await setRolePermissions(selectedRole, targetKeys.map((k) => Number(k)))
      message.success('权限配置已保存')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <Typography.Title className="page-title">权限管理</Typography.Title>

      <Card style={{ marginTop: 24 }}>
        <div style={{ marginBottom: 24 }}>
          <Select
            placeholder="选择角色"
            style={{ width: 240 }}
            value={selectedRole}
            onChange={(value) => setSelectedRole(value)}
          >
            {roles.map((r) => (
              <Option key={r.id} value={r.id}>
                {r.name === 'super_admin' ? '超级管理员' : r.name === 'admin' ? '管理员' : '普通用户'}
              </Option>
            ))}
          </Select>
        </div>

        {selectedRole ? (
          loading ? (
            <Spin />
          ) : (
            <div>
              <Transfer
                dataSource={permissions.map((p) => ({
                  key: String(p.id),
                  title: p.name,
                  description: p.description || '',
                }))}
                titles={['可用权限', '已分配权限']}
                targetKeys={targetKeys}
                onChange={(nextTargetKeys) => setTargetKeys(nextTargetKeys as string[])}
                render={(item) => `${item.title}${item.description ? ` - ${item.description}` : ''}`}
                listStyle={{ width: 400, height: 400 }}
                oneWay
              />
              <div style={{ marginTop: 24 }}>
                <Button type="primary" loading={saving} onClick={handleSave}>
                  保存权限配置
                </Button>
              </div>
            </div>
          )
        ) : (
          <Typography.Text type="secondary">请选择一个角色进行权限配置</Typography.Text>
        )}
      </Card>
    </div>
  )
}

export default Permissions

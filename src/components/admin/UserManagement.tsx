'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { User } from '@/lib/admin-service'
import { useAuth } from '@/lib/auth-context'
import { formatRelativeTime } from '@/lib/utils'
import { logger } from '@/lib/logger'

export interface UserManagementProps {
  className?: string
}

export function UserManagement({ className = '' }: UserManagementProps) {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const { user } = useAuth()

  const limit = 20

  // Load users
  const loadUsers = async (reset = false) => {
    if (!user || user.role !== 'admin') return

    setLoading(true)
    setError(null)

    try {
      const currentOffset = reset ? 0 : offset
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: currentOffset.toString()
      })

      if (roleFilter) params.append('role', roleFilter)
      if (searchTerm) params.append('search', searchTerm)

      const response = await fetch(`/api/admin/users?${params}`, {
        headers: {
          'Authorization': `Bearer ${user.id}` // This would need proper token handling
        }
      })

      if (!response.ok) {
        throw new Error('Failed to load users')
      }

      const data = await response.json()
      
      if (data.success) {
        if (reset) {
          setUsers(data.data.users)
          setOffset(limit)
        } else {
          setUsers(prev => [...prev, ...data.data.users])
          setOffset(prev => prev + limit)
        }
        setHasMore(data.data.hasMore)
      } else {
        throw new Error(data.error?.message || 'Failed to load users')
      }
    } catch (err) {
      logger.error('Failed to load users', err as Error)
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  // Delete user
  const deleteUser = async (userId: string) => {
    if (!user || !confirm('Are you sure you want to delete this user? This action cannot be undone.')) return

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${user.id}` // This would need proper token handling
        }
      })

      if (!response.ok) {
        throw new Error('Failed to delete user')
      }

      // Remove user from local state
      setUsers(prev => prev.filter(u => u.id !== userId))
      
      logger.info('User deleted', { userId })
    } catch (err) {
      logger.error('Failed to delete user', err as Error)
      alert('Failed to delete user: ' + (err as Error).message)
    }
  }

  // Update user role
  const updateUserRole = async (userId: string, newRole: 'patient' | 'doctor' | 'admin') => {
    if (!user) return

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.id}` // This would need proper token handling
        },
        body: JSON.stringify({ role: newRole })
      })

      if (!response.ok) {
        throw new Error('Failed to update user role')
      }

      const data = await response.json()
      
      if (data.success) {
        // Update user in local state
        setUsers(prev => prev.map(u => 
          u.id === userId ? { ...u, role: newRole } : u
        ))
        
        logger.info('User role updated', { userId, newRole })
      } else {
        throw new Error(data.error?.message || 'Failed to update user role')
      }
    } catch (err) {
      logger.error('Failed to update user role', err as Error)
      alert('Failed to update user role: ' + (err as Error).message)
    }
  }

  useEffect(() => {
    loadUsers(true)
  }, [user, searchTerm, roleFilter])

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800'
      case 'doctor':
        return 'bg-blue-100 text-blue-800'
      case 'patient':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading && users.length === 0) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
          <p className="text-gray-600 mt-1">Manage system users and their roles</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Add User
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search users by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="sm:w-48">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              >
                <option value="">All Roles</option>
                <option value="patient">Patients</option>
                <option value="doctor">Doctors</option>
                <option value="admin">Admins</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-800">{error}</p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => loadUsers(true)}
                className="mt-2"
              >
                Try Again
              </Button>
            </div>
          </div>
        </div>
      )}      {/
* Users List */}
      <Card>
        <CardHeader>
          <CardTitle>Users ({users.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {users.length > 0 ? (
            <div className="space-y-4">
              {users.map((userItem) => (
                <div key={userItem.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-gray-600">
                        {userItem.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="font-medium text-gray-900">{userItem.name}</h3>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(userItem.role)}`}>
                          {userItem.role}
                        </span>
                        {!userItem.emailConfirmed && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            Unverified
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{userItem.email}</p>
                      <p className="text-xs text-gray-500">
                        Joined {formatRelativeTime(userItem.createdAt)}
                        {userItem.lastSignIn && ` • Last active ${formatRelativeTime(userItem.lastSignIn)}`}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {/* Role Change Dropdown */}
                    <select
                      value={userItem.role}
                      onChange={(e) => updateUserRole(userItem.id, e.target.value as 'patient' | 'doctor' | 'admin')}
                      className="text-sm border border-gray-300 rounded px-2 py-1 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                      disabled={userItem.id === user?.id} // Prevent admin from changing their own role
                    >
                      <option value="patient">Patient</option>
                      <option value="doctor">Doctor</option>
                      <option value="admin">Admin</option>
                    </select>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedUser(userItem)}
                    >
                      View
                    </Button>
                    
                    {userItem.id !== user?.id && ( // Prevent admin from deleting themselves
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteUser(userItem.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No users found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchTerm || roleFilter ? 'Try adjusting your search criteria.' : 'Get started by adding a new user.'}
              </p>
            </div>
          )}

          {/* Load More */}
          {hasMore && (
            <div className="text-center mt-6">
              <Button
                variant="outline"
                onClick={() => loadUsers(false)}
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Load More'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Details Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">User Details</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedUser(null)}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </Button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <p className="mt-1 text-sm text-gray-900">{selectedUser.name}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <p className="mt-1 text-sm text-gray-900">{selectedUser.email}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Role</label>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(selectedUser.role)}`}>
                  {selectedUser.role}
                </span>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Status</label>
                <p className="mt-1 text-sm text-gray-900">
                  {selectedUser.emailConfirmed ? 'Verified' : 'Unverified'}
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Joined</label>
                <p className="mt-1 text-sm text-gray-900">
                  {new Date(selectedUser.createdAt).toLocaleDateString()}
                </p>
              </div>
              
              {selectedUser.lastSignIn && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Last Sign In</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {new Date(selectedUser.lastSignIn).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
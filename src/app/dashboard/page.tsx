import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { Navbar } from '@/components/Navbar'

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="mt-2 text-gray-600">
              Welcome to your medical diagnosis assistant dashboard
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg bg-white p-6 shadow">
              <h3 className="text-lg font-medium text-gray-900">Quick Actions</h3>
              <p className="mt-2 text-sm text-gray-600">
                Get started with common tasks
              </p>
            </div>

            <div className="rounded-lg bg-white p-6 shadow">
              <h3 className="text-lg font-medium text-gray-900">Recent Activity</h3>
              <p className="mt-2 text-sm text-gray-600">
                View your recent reports and updates
              </p>
            </div>

            <div className="rounded-lg bg-white p-6 shadow">
              <h3 className="text-lg font-medium text-gray-900">Statistics</h3>
              <p className="mt-2 text-sm text-gray-600">
                Overview of your account activity
              </p>
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  )
}

export const metadata = {
  title: 'Dashboard - MedAssist AI',
  description: 'Your medical diagnosis assistant dashboard',
}
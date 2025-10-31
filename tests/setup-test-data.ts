/**
 * Test Data Setup Script
 * 
 * Creates test users and sample data for integration testing
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Missing Supabase configuration')
  console.error('Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface TestUser {
  email: string
  password: string
  name: string
  role: 'patient' | 'doctor' | 'admin'
}

const testUsers: TestUser[] = [
  {
    email: 'patient1@test.com',
    password: 'TestPatient123!',
    name: 'Test Patient 1',
    role: 'patient'
  },
  {
    email: 'patient2@test.com',
    password: 'TestPatient123!',
    name: 'Test Patient 2',
    role: 'patient'
  },
  {
    email: 'doctor1@test.com',
    password: 'TestDoctor123!',
    name: 'Dr. Test Doctor 1',
    role: 'doctor'
  },
  {
    email: 'doctor2@test.com',
    password: 'TestDoctor123!',
    name: 'Dr. Test Doctor 2',
    role: 'doctor'
  },
  {
    email: 'admin@test.com',
    password: 'TestAdmin123!',
    name: 'Test Admin',
    role: 'admin'
  }
]

async function setupTestData() {
  console.log('='.repeat(80))
  console.log('Setting up test data for AI Medical Diagnosis Assistant')
  console.log('='.repeat(80))
  console.log('')

  // Create test users
  console.log('Creating test users...')
  for (const user of testUsers) {
    try {
      const { data, error } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: {
          name: user.name,
          role: user.role
        }
      })

      if (error) {
        if (error.message.includes('already registered')) {
          console.log(`  ⊘ ${user.email} already exists`)
        } else {
          console.error(`  ✗ Error creating ${user.email}:`, error.message)
        }
      } else {
        console.log(`  ✓ Created ${user.email} (${user.role})`)
        
        // Update user profile in users table
        if (data.user) {
          const { error: profileError } = await supabase
            .from('users')
            .upsert({
              id: data.user.id,
              email: user.email,
              name: user.name,
              role: user.role,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })

          if (profileError) {
            console.error(`    ✗ Error creating profile:`, profileError.message)
          }
        }
      }
    } catch (error: any) {
      console.error(`  ✗ Error creating ${user.email}:`, error.message)
    }
  }

  console.log('')
  console.log('Test data setup complete!')
  console.log('')
  console.log('Test User Credentials:')
  console.log('-'.repeat(80))
  testUsers.forEach(user => {
    console.log(`${user.role.toUpperCase().padEnd(10)} - ${user.email.padEnd(25)} - ${user.password}`)
  })
  console.log('-'.repeat(80))
  console.log('')
  console.log('You can now use these accounts for testing.')
  console.log('Remember to delete test data after testing is complete.')
}

async function cleanupTestData() {
  console.log('='.repeat(80))
  console.log('Cleaning up test data')
  console.log('='.repeat(80))
  console.log('')

  console.log('Deleting test users...')
  for (const user of testUsers) {
    try {
      // Get user by email
      const { data: users } = await supabase.auth.admin.listUsers()
      const testUser = users?.users.find(u => u.email === user.email)

      if (testUser) {
        // Delete user
        const { error } = await supabase.auth.admin.deleteUser(testUser.id)
        
        if (error) {
          console.error(`  ✗ Error deleting ${user.email}:`, error.message)
        } else {
          console.log(`  ✓ Deleted ${user.email}`)
        }
      } else {
        console.log(`  ⊘ ${user.email} not found`)
      }
    } catch (error: any) {
      console.error(`  ✗ Error deleting ${user.email}:`, error.message)
    }
  }

  console.log('')
  console.log('Cleanup complete!')
}

// Parse command line arguments
const args = process.argv.slice(2)
const command = args[0]

if (command === 'cleanup') {
  cleanupTestData().catch(error => {
    console.error('Fatal error during cleanup:', error)
    process.exit(1)
  })
} else {
  setupTestData().catch(error => {
    console.error('Fatal error during setup:', error)
    process.exit(1)
  })
}

export { setupTestData, cleanupTestData }
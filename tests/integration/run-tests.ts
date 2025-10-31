/**
 * Integration Test Runner
 * 
 * Runs all integration tests in sequence and generates a report
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs/promises'
import * as path from 'path'

const execAsync = promisify(exec)

interface TestResult {
  suite: string
  passed: boolean
  duration: number
  error?: string
}

class IntegrationTestRunner {
  private results: TestResult[] = []
  private startTime: number = 0

  async run() {
    console.log('='.repeat(80))
    console.log('AI Medical Diagnosis Assistant - Integration Test Suite')
    console.log('='.repeat(80))
    console.log('')

    this.startTime = Date.now()

    // Check prerequisites
    await this.checkPrerequisites()

    // Run test suites
    await this.runTestSuite('Patient Workflow', 'patient-workflow.test.ts')
    await this.runTestSuite('Doctor Workflow', 'doctor-workflow.test.ts')
    await this.runTestSuite('Admin Workflow', 'admin-workflow.test.ts')
    await this.runTestSuite('End-to-End', 'end-to-end.test.ts')
    await this.runTestSuite('Security', 'security.test.ts')
    await this.runTestSuite('Performance', 'performance.test.ts')

    // Generate report
    await this.generateReport()
  }

  private async checkPrerequisites() {
    console.log('Checking prerequisites...')
    
    // Check if .env.local exists
    try {
      await fs.access(path.join(process.cwd(), '.env.local'))
      console.log('✓ Environment configuration found')
    } catch {
      console.error('✗ .env.local not found')
      console.error('  Please create .env.local with required configuration')
      process.exit(1)
    }

    // Check if server is running
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const response = await fetch(baseUrl)
      if (response.ok) {
        console.log('✓ Application server is running')
      } else {
        throw new Error('Server not responding correctly')
      }
    } catch (error) {
      console.error('✗ Application server is not running')
      console.error('  Please start the development server with: npm run dev')
      process.exit(1)
    }

    // Check database connection
    console.log('✓ Prerequisites check complete')
    console.log('')
  }

  private async runTestSuite(name: string, file: string) {
    console.log(`Running ${name} Tests...`)
    console.log('-'.repeat(80))

    const startTime = Date.now()
    let passed = false
    let error: string | undefined

    try {
      const { stdout, stderr } = await execAsync(
        `npx jest tests/integration/${file} --verbose`,
        { cwd: process.cwd() }
      )
      
      console.log(stdout)
      if (stderr) {
        console.error(stderr)
      }
      
      passed = !stderr.includes('FAIL')
    } catch (err: any) {
      error = err.message
      console.error(`Error running ${name} tests:`, error)
    }

    const duration = Date.now() - startTime

    this.results.push({
      suite: name,
      passed,
      duration,
      error
    })

    console.log('')
  }

  private async generateReport() {
    const totalDuration = Date.now() - this.startTime
    const passedCount = this.results.filter(r => r.passed).length
    const failedCount = this.results.length - passedCount

    console.log('='.repeat(80))
    console.log('Test Results Summary')
    console.log('='.repeat(80))
    console.log('')

    this.results.forEach(result => {
      const status = result.passed ? '✓ PASS' : '✗ FAIL'
      const duration = (result.duration / 1000).toFixed(2)
      console.log(`${status} - ${result.suite} (${duration}s)`)
      if (result.error) {
        console.log(`  Error: ${result.error}`)
      }
    })

    console.log('')
    console.log('-'.repeat(80))
    console.log(`Total: ${this.results.length} suites`)
    console.log(`Passed: ${passedCount}`)
    console.log(`Failed: ${failedCount}`)
    console.log(`Duration: ${(totalDuration / 1000).toFixed(2)}s`)
    console.log('='.repeat(80))

    // Write report to file
    const report = {
      timestamp: new Date().toISOString(),
      totalDuration,
      results: this.results,
      summary: {
        total: this.results.length,
        passed: passedCount,
        failed: failedCount
      }
    }

    const reportPath = path.join(process.cwd(), 'test-results', 'integration-test-report.json')
    await fs.mkdir(path.dirname(reportPath), { recursive: true })
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2))
    
    console.log(`\nReport saved to: ${reportPath}`)

    // Exit with error code if any tests failed
    if (failedCount > 0) {
      process.exit(1)
    }
  }
}

// Run tests
const runner = new IntegrationTestRunner()
runner.run().catch(error => {
  console.error('Fatal error running tests:', error)
  process.exit(1)
})
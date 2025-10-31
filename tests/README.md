# Testing Guide

This directory contains all testing resources for the AI Medical Diagnosis Assistant.

## Overview

The testing strategy includes:
- **Integration Tests**: Automated API and workflow tests
- **Manual Tests**: UI/UX and end-to-end testing checklists
- **Performance Tests**: Load and response time verification
- **Security Tests**: Authentication and authorization validation

## Quick Start

### 1. Setup Test Environment

```bash
# Install dependencies
npm install

# Setup test data (creates test users)
npm run test:setup
```

### 2. Run Integration Tests

```bash
# Make sure the development server is running
npm run dev

# In another terminal, run integration tests
npm run test:integration
```

### 3. Manual Testing

Follow the comprehensive checklist in `/MANUAL_TESTING_CHECKLIST.md`

### 4. Cleanup

```bash
# Remove test data after testing
npm run test:cleanup
```

## Test Structure

```
tests/
├── integration/           # Automated integration tests
│   ├── patient-workflow.test.ts
│   ├── doctor-workflow.test.ts
│   ├── admin-workflow.test.ts
│   ├── end-to-end.test.ts
│   ├── security.test.ts
│   ├── performance.test.ts
│   └── run-tests.ts      # Test runner
├── setup-test-data.ts    # Test data setup script
└── README.md             # This file
```

## Integration Tests

### Patient Workflow Tests
Tests the complete patient journey:
- Registration and login
- Symptom submission
- AI diagnosis generation
- Report viewing
- Notifications
- Authorization controls

### Doctor Workflow Tests
Tests doctor-specific functionality:
- Doctor authentication
- Verification queue access
- Report verification
- Doctor notes management
- Statistics viewing

### Admin Workflow Tests
Tests administrative features:
- User management
- System analytics
- Error monitoring
- Audit logs
- System configuration

### End-to-End Tests
Tests complete workflows across roles:
- Patient submits → Doctor verifies → Patient views
- Multi-user concurrent operations
- Data flow integrity

### Security Tests
Tests security controls:
- Authentication mechanisms
- Authorization enforcement
- Data privacy measures
- API security
- Session management

### Performance Tests
Tests system performance:
- Response time requirements
- Concurrent user handling
- Database query performance
- API endpoint speed

## Test Data

### Test Users

The setup script creates these test accounts:

| Role    | Email                | Password          |
|---------|---------------------|-------------------|
| Patient | patient1@test.com   | TestPatient123!   |
| Patient | patient2@test.com   | TestPatient123!   |
| Doctor  | doctor1@test.com    | TestDoctor123!    |
| Doctor  | doctor2@test.com    | TestDoctor123!    |
| Admin   | admin@test.com      | TestAdmin123!     |

### Sample Symptoms

Use these for testing AI diagnosis:

1. **Respiratory**: "Persistent cough for 2 weeks, shortness of breath, chest tightness, fever of 100.5°F"
2. **Digestive**: "Severe abdominal pain in lower right quadrant, nausea, vomiting, loss of appetite for 24 hours"
3. **Neurological**: "Severe headache with visual disturbances, sensitivity to light, nausea for 6 hours"
4. **Skin**: "Red, itchy rash on arms and legs, appeared 3 days ago, spreading gradually"
5. **Cardiovascular**: "Chest pain radiating to left arm, shortness of breath, sweating, started 30 minutes ago"

## Running Specific Tests

### Run Patient Tests Only
```bash
npx jest tests/integration/patient-workflow.test.ts
```

### Run Doctor Tests Only
```bash
npx jest tests/integration/doctor-workflow.test.ts
```

### Run with Verbose Output
```bash
npx jest tests/integration/patient-workflow.test.ts --verbose
```

### Run in Watch Mode
```bash
npx jest tests/integration/patient-workflow.test.ts --watch
```

## Test Configuration

### Environment Variables

Ensure these are set in `.env.local`:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key
GEMINI_API_KEY=your_gemini_key
```

### Test Timeouts

Some tests have extended timeouts:
- AI diagnosis tests: 30 seconds
- File upload tests: 20 seconds
- Default: 5 seconds

## Continuous Integration

### GitHub Actions (Example)

```yaml
name: Integration Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm run test:setup
      - run: npm run dev &
      - run: npm run test:integration
      - run: npm run test:cleanup
```

## Test Reports

Test results are saved to:
```
test-results/
└── integration-test-report.json
```

The report includes:
- Test suite results
- Pass/fail status
- Execution duration
- Error details
- Timestamp

## Troubleshooting

### Tests Fail to Connect

**Problem**: Tests cannot connect to the application

**Solution**:
1. Ensure development server is running: `npm run dev`
2. Check `NEXT_PUBLIC_APP_URL` in `.env.local`
3. Verify no firewall blocking localhost

### Authentication Errors

**Problem**: Tests fail with 401 Unauthorized

**Solution**:
1. Run `npm run test:setup` to create test users
2. Verify Supabase configuration
3. Check JWT token generation

### AI Diagnosis Timeouts

**Problem**: AI diagnosis tests timeout

**Solution**:
1. Verify `GEMINI_API_KEY` is valid
2. Check API quota limits
3. Increase test timeout if needed
4. Verify network connectivity

### Database Errors

**Problem**: Tests fail with database errors

**Solution**:
1. Verify Supabase connection
2. Check database migrations are applied
3. Verify RLS policies are configured
4. Check service role key permissions

### Rate Limiting Issues

**Problem**: Tests hit rate limits

**Solution**:
1. Add delays between test runs
2. Use different test accounts
3. Adjust rate limit configuration for testing
4. Run tests sequentially instead of parallel

## Best Practices

### Writing Tests

1. **Isolation**: Each test should be independent
2. **Cleanup**: Always clean up test data
3. **Assertions**: Use specific, meaningful assertions
4. **Error Handling**: Test both success and failure cases
5. **Documentation**: Comment complex test logic

### Test Data

1. **Unique Identifiers**: Use timestamps in test emails
2. **Realistic Data**: Use realistic symptoms and scenarios
3. **Cleanup**: Always remove test data after testing
4. **Separation**: Keep test data separate from production

### Performance

1. **Parallel Execution**: Run independent tests in parallel
2. **Mocking**: Mock external services when appropriate
3. **Caching**: Cache authentication tokens
4. **Timeouts**: Set appropriate timeouts for operations

## Manual Testing

For comprehensive manual testing, refer to:
- `/MANUAL_TESTING_CHECKLIST.md` - Complete manual test checklist
- `/INTEGRATION_TESTING.md` - Detailed integration test scenarios

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review test logs in `test-results/`
3. Check application logs
4. Verify environment configuration

## Contributing

When adding new tests:
1. Follow existing test structure
2. Add appropriate documentation
3. Update this README if needed
4. Ensure tests are independent
5. Include cleanup procedures

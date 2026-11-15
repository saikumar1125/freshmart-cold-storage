// Task 5: runs the 3 twist tests from the brief against the running server
// Start the server first (npm run dev), then in a second terminal: npm run test:twist
const BASE = 'http://localhost:3000'

const call = async (method, url, body) => {
  const res = await fetch(BASE + url, {
    method,
    headers: {'Content-Type': 'application/json'},
    body: body ? JSON.stringify(body) : undefined,
  })
  return {status: res.status, body: await res.json()}
}

const check = (name, actual, expected, extra = '') => {
  const ok = actual === expected
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} -> ${actual} (expected ${expected}) ${extra}`)
  return ok
}

const run = async () => {
  // Setup: make sure Shelf 7 is free before the tests start
  const active = await call('GET', '/leases?status=active')
  for (const lease of active.body.filter((l) => l.shelf_name === 'Shelf 7')) {
    await call('PUT', `/leases/${lease.lease_id}/return`)
  }
  console.log('Setup: Shelf 7 is free\n')

  let allOk = true
  const t1 = await call('POST', '/leases', {vendor_id: 1, shelf_id: 7})
  allOk = check('Test 1: Lease Shelf 7 to Asha', t1.status, 201, JSON.stringify(t1.body)) && allOk

  const t2 = await call('POST', '/leases', {vendor_id: 2, shelf_id: 7})
  allOk = check('Test 2: Lease Shelf 7 to Ravi', t2.status, 409, JSON.stringify(t2.body)) && allOk
  allOk = check('        Message', t2.body.message, 'Shelf 7 is already leased') && allOk

  const t3a = await call('PUT', `/leases/${t1.body.lease_id}/return`)
  allOk = check('Test 3: Return Shelf 7', t3a.status, 200, JSON.stringify(t3a.body)) && allOk
  const t3b = await call('POST', '/leases', {vendor_id: 2, shelf_id: 7})
  allOk = check('        Lease Shelf 7 to Ravi', t3b.status, 201, JSON.stringify(t3b.body)) && allOk

  console.log(allOk ? '\nAll twist tests passed.' : '\nSome tests failed.')
  process.exitCode = allOk ? 0 : 1
}

run().catch((error) => {
  console.log('Could not reach the server. Is "npm run dev" running?', error.message)
  process.exitCode = 1
})

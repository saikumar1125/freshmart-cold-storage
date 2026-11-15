// FreshMart Cold Storage API
// Task 1: Server and routes | Task 2: Database | Task 3: REST endpoints
// Task 4: Validation and search | Task 5: Twist rule (no double booking)

const express = require('express')
const path = require('path')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')

const app = express()
app.use(express.json())

const dbPath = path.join(__dirname, 'freshmart.db')
let db = null

// ---------------- TASK 2: DATABASE ----------------

const createTables = async () => {
  await db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS vendors (
      vendor_id INTEGER PRIMARY KEY AUTOINCREMENT,
      vendor_name TEXT NOT NULL,
      phone TEXT
    );

    CREATE TABLE IF NOT EXISTS shelves (
      shelf_id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      temperature REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS leases (
      lease_id INTEGER PRIMARY KEY AUTOINCREMENT,
      vendor_id INTEGER NOT NULL,
      shelf_id INTEGER NOT NULL,
      start_date TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      end_date TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      FOREIGN KEY (vendor_id) REFERENCES vendors (vendor_id) ON DELETE CASCADE,
      FOREIGN KEY (shelf_id) REFERENCES shelves (shelf_id) ON DELETE CASCADE
    );

    -- Task 5 safety net: only one ACTIVE lease per shelf is allowed
    CREATE UNIQUE INDEX IF NOT EXISTS one_active_lease_per_shelf
    ON leases (shelf_id) WHERE status = 'active';
  `)
}

const insertDemoData = async () => {
  const row = await db.get('SELECT COUNT(*) AS count FROM vendors')
  if (row.count > 0) return

  await db.run(`INSERT INTO vendors (vendor_name, phone) VALUES
    ('Asha', '9876500001'), ('Ravi', '9876500002'), ('Meena', '9876500003')`)

  for (let i = 1; i <= 10; i++) {
    const temperature = i <= 5 ? -18 : -25
    await db.run('INSERT INTO shelves (name, temperature) VALUES (?, ?)', [
      `Shelf ${i}`,
      temperature,
    ])
  }
}

// ---------------- TASK 1: SERVER SETUP ----------------

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    await createTables()
    await insertDemoData()

    app.listen(3000, () => {
      console.log('Server Running at http://localhost:3000/')
    })
  } catch (error) {
    console.log(`DB Error: ${error.message}`)
    process.exit(1)
  }
}

initializeDBAndServer()

app.get('/', (request, response) => {
  response.send({
    message: 'FreshMart Cold Storage API',
    routes: ['/vendors', '/shelves', '/leases'],
  })
})

// ---------------- TASK 4: VALIDATION HELPERS ----------------

const validateShelf = (name, temperature) => {
  if (name === undefined || temperature === undefined) {
    return 'Name and temperature are required'
  }
  if (typeof name !== 'string' || name.trim() === '') {
    return 'Name must be a non-empty text'
  }
  if (typeof temperature !== 'number') {
    return 'Temperature must be a number'
  }
  if (temperature < -40 || temperature > 10) {
    return 'Temperature must be between -40 and 10 degrees Celsius'
  }
  return null
}

// ---------------- TASK 3 + 4: SHELVES (CRUD + SEARCH) ----------------

// Get all shelves, with search and sorting
// /shelves?temperature=-18   /shelves?name=7   /shelves?sort=temperature&order=desc
app.get('/shelves', async (request, response) => {
  const {temperature, name, sort, order} = request.query
  const allowedFields = ['shelf_id', 'name', 'temperature']
  const sortField = sort || 'shelf_id'
  const sortOrder = order || 'asc'

  if (!allowedFields.includes(sortField)) {
    response.status(400)
    response.send({message: 'Cannot sort by that field'})
    return
  }
  if (!['asc', 'desc'].includes(sortOrder.toLowerCase())) {
    response.status(400)
    response.send({message: 'Invalid sort order'})
    return
  }

  let query = 'SELECT * FROM shelves'
  const conditions = []
  const params = []

  if (temperature !== undefined) {
    if (temperature.trim() === '' || isNaN(temperature)) {
      response.status(400)
      response.send({message: 'Temperature must be a number'})
      return
    }
    conditions.push('temperature = ?')
    params.push(Number(temperature))
  }
  if (name) {
    conditions.push('name LIKE ?')
    params.push(`%${name}%`)
  }
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ')
  }

  query += ` ORDER BY ${sortField} ${sortOrder.toUpperCase()}`
  const shelves = await db.all(query, params)
  response.send(shelves)
})

// Get one shelf
app.get('/shelves/:id', async (request, response) => {
  const {id} = request.params
  const shelf = await db.get('SELECT * FROM shelves WHERE shelf_id = ?', [id])

  if (shelf === undefined) {
    response.status(404)
    response.send({message: 'Shelf Not Found'})
  } else {
    response.send(shelf)
  }
})

// Add a shelf
app.post('/shelves', async (request, response) => {
  const {name, temperature} = request.body || {}
  const error = validateShelf(name, temperature)
  if (error) {
    response.status(400)
    response.send({message: error})
    return
  }

  const existing = await db.get('SELECT * FROM shelves WHERE name = ?', [name.trim()])
  if (existing) {
    response.status(409)
    response.send({message: `${name.trim()} already exists`})
    return
  }

  const result = await db.run('INSERT INTO shelves (name, temperature) VALUES (?, ?)', [
    name.trim(),
    temperature,
  ])
  response.status(201)
  response.send({message: 'Shelf Added Successfully', shelf_id: result.lastID})
})

// Update a shelf
app.put('/shelves/:id', async (request, response) => {
  const {id} = request.params
  const {name, temperature} = request.body || {}
  const error = validateShelf(name, temperature)
  if (error) {
    response.status(400)
    response.send({message: error})
    return
  }

  const result = await db.run(
    'UPDATE shelves SET name = ?, temperature = ? WHERE shelf_id = ?',
    [name.trim(), temperature, id],
  )

  if (result.changes === 0) {
    response.status(404)
    response.send({message: 'Shelf Not Found'})
  } else {
    response.send({message: 'Shelf Updated Successfully'})
  }
})

// Delete a shelf
app.delete('/shelves/:id', async (request, response) => {
  const {id} = request.params
  const activeLease = await db.get(
    "SELECT * FROM leases WHERE shelf_id = ? AND status = 'active'",
    [id],
  )
  if (activeLease) {
    response.status(409)
    response.send({message: 'Shelf is leased right now and cannot be deleted'})
    return
  }

  const result = await db.run('DELETE FROM shelves WHERE shelf_id = ?', [id])
  if (result.changes === 0) {
    response.status(404)
    response.send({message: 'Shelf Not Found'})
  } else {
    response.send({message: 'Shelf Deleted Successfully'})
  }
})

// ---------------- TASK 3: VENDORS ----------------

app.get('/vendors', async (request, response) => {
  const vendors = await db.all('SELECT * FROM vendors ORDER BY vendor_id')
  response.send(vendors)
})

app.get('/vendors/:id', async (request, response) => {
  const {id} = request.params
  const vendor = await db.get('SELECT * FROM vendors WHERE vendor_id = ?', [id])

  if (vendor === undefined) {
    response.status(404)
    response.send({message: 'Vendor Not Found'})
  } else {
    response.send(vendor)
  }
})

app.post('/vendors', async (request, response) => {
  const {vendor_name, phone} = request.body || {}

  if (!vendor_name || typeof vendor_name !== 'string') {
    response.status(400)
    response.send({message: 'Vendor name is required'})
    return
  }
  if (phone !== undefined && !/^\d{10}$/.test(String(phone))) {
    response.status(400)
    response.send({message: 'Phone must be 10 digits'})
    return
  }

  const result = await db.run('INSERT INTO vendors (vendor_name, phone) VALUES (?, ?)', [
    vendor_name.trim(),
    phone || null,
  ])
  response.status(201)
  response.send({message: 'Vendor Added Successfully', vendor_id: result.lastID})
})

// ---------------- TASK 3: LEASES JOIN ----------------

// Get all leases with the vendor name and shelf name
// /leases?status=active  shows only shelves that are leased right now
app.get('/leases', async (request, response) => {
  const {status} = request.query
  let query = `
    SELECT
      leases.lease_id,
      vendors.vendor_name,
      shelves.name AS shelf_name,
      shelves.temperature,
      leases.start_date,
      leases.end_date,
      leases.status
    FROM leases
    INNER JOIN vendors ON leases.vendor_id = vendors.vendor_id
    INNER JOIN shelves ON leases.shelf_id = shelves.shelf_id`
  const params = []

  if (status) {
    if (!['active', 'returned'].includes(status)) {
      response.status(400)
      response.send({message: 'Status must be active or returned'})
      return
    }
    query += ' WHERE leases.status = ?'
    params.push(status)
  }

  const leases = await db.all(query + ' ORDER BY leases.lease_id', params)
  response.send(leases)
})

// ---------------- TASK 5: TWIST - NO DOUBLE BOOKING ----------------

// Lease a shelf to a vendor
app.post('/leases', async (request, response) => {
  const {vendor_id, shelf_id} = request.body || {}

  if (!Number.isInteger(vendor_id) || !Number.isInteger(shelf_id)) {
    response.status(400)
    response.send({message: 'vendor_id and shelf_id are required and must be numbers'})
    return
  }

  const vendor = await db.get('SELECT * FROM vendors WHERE vendor_id = ?', [vendor_id])
  if (vendor === undefined) {
    response.status(404)
    response.send({message: 'Vendor Not Found'})
    return
  }

  const shelf = await db.get('SELECT * FROM shelves WHERE shelf_id = ?', [shelf_id])
  if (shelf === undefined) {
    response.status(404)
    response.send({message: 'Shelf Not Found'})
    return
  }

  // The twist: is this shelf already leased to someone?
  const activeLease = await db.get(
    "SELECT * FROM leases WHERE shelf_id = ? AND status = 'active'",
    [shelf_id],
  )
  if (activeLease) {
    response.status(409)
    response.send({message: `${shelf.name} is already leased`})
    return
  }

  try {
    const result = await db.run('INSERT INTO leases (vendor_id, shelf_id) VALUES (?, ?)', [
      vendor_id,
      shelf_id,
    ])
    response.status(201)
    response.send({
      message: `${shelf.name} leased to ${vendor.vendor_name}`,
      lease_id: result.lastID,
    })
  } catch (error) {
    // Two requests at the same moment: the unique index stops the second one
    response.status(409)
    response.send({message: `${shelf.name} is already leased`})
  }
})

// Return a shelf so it can be leased again
app.put('/leases/:id/return', async (request, response) => {
  const {id} = request.params
  const lease = await db.get('SELECT * FROM leases WHERE lease_id = ?', [id])

  if (lease === undefined) {
    response.status(404)
    response.send({message: 'Lease Not Found'})
    return
  }
  if (lease.status === 'returned') {
    response.status(409)
    response.send({message: 'This lease was already returned'})
    return
  }

  await db.run(
    "UPDATE leases SET status = 'returned', end_date = datetime('now', 'localtime') WHERE lease_id = ?",
    [id],
  )
  response.send({message: 'Shelf Returned Successfully'})
})

module.exports = app

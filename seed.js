// Task 2: resets the database to the demo data (3 vendors, 10 shelves, no leases)
// Run with: npm run seed   (works while the server is running)
const path = require('path')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')

const reset = async () => {
  const db = await open({
    filename: path.join(__dirname, 'freshmart.db'),
    driver: sqlite3.Database,
  })

  await db.exec(`
    DELETE FROM leases;
    DELETE FROM shelves;
    DELETE FROM vendors;
    DELETE FROM sqlite_sequence;
  `)

  await db.run(`INSERT INTO vendors (vendor_name, phone) VALUES
    ('Asha', '9876500001'), ('Ravi', '9876500002'), ('Meena', '9876500003')`)

  for (let i = 1; i <= 10; i++) {
    await db.run('INSERT INTO shelves (name, temperature) VALUES (?, ?)', [
      `Shelf ${i}`,
      i <= 5 ? -18 : -25,
    ])
  }

  console.log('Database reset: 3 vendors (Asha=1, Ravi=2, Meena=3), 10 shelves, 0 leases')
  await db.close()
}

reset().catch((error) => {
  console.log(`Seed Error: ${error.message}. Start the server once first so the tables exist.`)
})

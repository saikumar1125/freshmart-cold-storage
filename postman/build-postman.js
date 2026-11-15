// Task 6: builds FreshMart.postman_collection.json
// Run with: node postman/build-postman.js
const fs = require('fs')
const path = require('path')

const statusTest = (code, extra = []) => [
  `pm.test("Status is ${code}", () => pm.response.to.have.status(${code}));`,
  ...extra,
]

const req = (name, method, url, {body, tests = []} = {}) => {
  const [pathPart, query] = url.split('?')
  return {
    name,
    event: [{listen: 'test', script: {type: 'text/javascript', exec: tests}}],
    request: {
      method,
      header: body ? [{key: 'Content-Type', value: 'application/json'}] : [],
      body: body ? {mode: 'raw', raw: JSON.stringify(body, null, 2)} : undefined,
      url: {
        raw: '{{baseUrl}}' + url,
        host: ['{{baseUrl}}'],
        path: pathPart.split('/').filter(Boolean),
        query: query
          ? query.split('&').map((q) => ({key: q.split('=')[0], value: q.split('=')[1]}))
          : undefined,
      },
    },
  }
}

const collection = {
  info: {
    name: 'FreshMart Cold Storage API',
    description: 'Start the server (npm run dev) and run npm run seed before running this collection.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  variable: [
    {key: 'baseUrl', value: 'http://localhost:3000'},
    {key: 'leaseId', value: ''},
    {key: 'newShelfId', value: ''},
  ],
  item: [
    {
      name: '1. Twist - No double booking',
      item: [
        req('Test 1 - Lease Shelf 7 to Asha (201)', 'POST', '/leases', {
          body: {vendor_id: 1, shelf_id: 7},
          tests: statusTest(201, ['pm.collectionVariables.set("leaseId", pm.response.json().lease_id);']),
        }),
        req('Test 2 - Lease Shelf 7 to Ravi (409)', 'POST', '/leases', {
          body: {vendor_id: 2, shelf_id: 7},
          tests: statusTest(409, [
            'pm.test("Message is Shelf 7 is already leased", () => pm.expect(pm.response.json().message).to.eql("Shelf 7 is already leased"));',
          ]),
        }),
        req('Test 3a - Return Shelf 7 (200)', 'PUT', '/leases/{{leaseId}}/return', {tests: statusTest(200)}),
        req('Test 3b - Lease Shelf 7 to Ravi (201)', 'POST', '/leases', {
          body: {vendor_id: 2, shelf_id: 7},
          tests: statusTest(201),
        }),
      ],
    },
    {
      name: '2. Shelves CRUD',
      item: [
        req('Get all shelves', 'GET', '/shelves', {tests: statusTest(200)}),
        req('Get one shelf', 'GET', '/shelves/7', {tests: statusTest(200)}),
        req('Get missing shelf (404)', 'GET', '/shelves/999', {tests: statusTest(404)}),
        req('Add shelf (201)', 'POST', '/shelves', {
          body: {name: 'Shelf 11', temperature: -20},
          tests: statusTest(201, ['pm.collectionVariables.set("newShelfId", pm.response.json().shelf_id);']),
        }),
        req('Update shelf', 'PUT', '/shelves/{{newShelfId}}', {
          body: {name: 'Shelf 11 Ice Cream', temperature: -22},
          tests: statusTest(200),
        }),
        req('Delete shelf', 'DELETE', '/shelves/{{newShelfId}}', {tests: statusTest(200)}),
      ],
    },
    {
      name: '3. Validation (400)',
      item: [
        req('Add shelf - empty body', 'POST', '/shelves', {body: {}, tests: statusTest(400)}),
        req('Add shelf - temperature is text', 'POST', '/shelves', {
          body: {name: 'Shelf X', temperature: 'cold'},
          tests: statusTest(400),
        }),
        req('Add shelf - temperature too warm', 'POST', '/shelves', {
          body: {name: 'Shelf X', temperature: 25},
          tests: statusTest(400),
        }),
        req('Lease - missing vendor_id', 'POST', '/leases', {body: {shelf_id: 3}, tests: statusTest(400)}),
      ],
    },
    {
      name: '4. Search and sort (query parameters)',
      item: [
        req('Shelves at -18 C', 'GET', '/shelves?temperature=-18', {tests: statusTest(200)}),
        req('Shelves by name', 'GET', '/shelves?name=7', {tests: statusTest(200)}),
        req('Sort by temperature desc', 'GET', '/shelves?sort=temperature&order=desc', {tests: statusTest(200)}),
        req('Sort by colour (400)', 'GET', '/shelves?sort=colour', {tests: statusTest(400)}),
      ],
    },
    {
      name: '5. Join and vendors',
      item: [
        req('All leases (join)', 'GET', '/leases', {tests: statusTest(200)}),
        req('Active leases only', 'GET', '/leases?status=active', {tests: statusTest(200)}),
        req('Get all vendors', 'GET', '/vendors', {tests: statusTest(200)}),
        req('Add vendor (201)', 'POST', '/vendors', {
          body: {vendor_name: 'Kiran', phone: '9876500004'},
          tests: statusTest(201),
        }),
      ],
    },
  ],
}

const out = path.join(__dirname, 'FreshMart.postman_collection.json')
fs.writeFileSync(out, JSON.stringify(collection, null, 2))
console.log('Wrote', out)

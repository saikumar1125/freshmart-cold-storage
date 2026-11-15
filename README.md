# FreshMart Cold Storage API

**BDF Group Assignment · NU-AIML2E-G11 · Theme 26: Freezer shelves**

> "Freezer shelves are rented to vendors by phone. A vendor found another vendor's goods on their shelf. Please build us a system that fixes this."

A Node.js + Express + SQLite API for vendors, freezer shelves and leases. **A shelf can never be leased to two active vendors at once.**

## How to run (VS Code or Antigravity)

1. Open the `freshmart-cold-storage` folder (File → Open Folder).
2. Open a terminal (Terminal → New Terminal) and run:

```bash
npm install
npm run dev
```

You should see `Server Running at http://localhost:3000/`. The database file `freshmart.db` and the demo data are created automatically.

3. In a second terminal, run the twist tests:

```bash
npm run test:twist
```

`npm run seed` resets the data (3 vendors, 10 shelves, no leases). Run it before a demo.

## Postman

Import `postman/FreshMart.postman_collection.json` and click **Run**. Folder *1. Twist* has the 3 required tests.

## Database

| Table | Columns |
|---|---|
| vendors | vendor_id, vendor_name, phone |
| shelves | shelf_id, name, temperature |
| leases | lease_id, vendor_id → vendors, shelf_id → shelves, start_date, end_date, status (active / returned) |

Demo data: Asha (1), Ravi (2), Meena (3); Shelf 1–10 (Shelf 1–5 at -18 °C, 6–10 at -25 °C).

## Endpoints

| Method | URL | Success | Errors |
|---|---|---|---|
| GET | /shelves | 200 | 400 bad search/sort |
| GET | /shelves?temperature=-18 · ?name=7 · ?sort=temperature&order=desc | 200 | 400 |
| GET | /shelves/:id | 200 | 404 |
| POST | /shelves `{name, temperature}` | 201 | 400, 409 name exists |
| PUT | /shelves/:id `{name, temperature}` | 200 | 400, 404 |
| DELETE | /shelves/:id | 200 | 404, 409 leased now |
| GET | /vendors, /vendors/:id | 200 | 404 |
| POST | /vendors `{vendor_name, phone}` | 201 | 400 |
| GET | /leases (join) · /leases?status=active | 200 | 400 |
| POST | /leases `{vendor_id, shelf_id}` | 201 | 400, 404, **409** |
| PUT | /leases/:id/return | 200 | 404, 409 |

## Twist: no double booking

| Test | Request | Result |
|---|---|---|
| 1 | POST /leases `{"vendor_id":1,"shelf_id":7}` | 201 |
| 2 | POST /leases `{"vendor_id":2,"shelf_id":7}` | 409 `{"message":"Shelf 7 is already leased"}` |
| 3 | PUT /leases/1/return, then POST /leases `{"vendor_id":2,"shelf_id":7}` | 201 |

Before inserting a lease, the API looks for a lease on that shelf with `status = 'active'`. If there is one it answers 409. A partial unique index in the database (`one_active_lease_per_shelf`) also blocks a second active lease.

## Files

| File | Task |
|---|---|
| app.js | 1 Server, 2 Database, 3 Endpoints, 4 Validation and search, 5 Twist |
| seed.js | 2 Database reset |
| twist-test.js | 5 Twist tests |
| postman/ | 6 Postman collection |
| README.md | 6 How to run |

# SportHub frontend

React application built with Vite and Tailwind CSS. Run commands from `frontend`:

- `npm run dev`: start the development server on port 5174.
- `npm run build`: build the production application.
- `npm run lint`: lint the code; unused variables and imports are errors.
- `npm run check:unused`: check unreferenced files, exports and dependencies with Knip.
- `npm run test:unit`: run the utility tests with Node.js.
- `npm run test:e2e`: run the Playwright browser tests.
- `npm run generate:favicons`: regenerate the application icons using the installed Edge browser.
- `npm run record:demo`: run the demo recording script.

## Authentication API

The sign-in and registration forms call the Spring Boot backend at
`http://localhost:8080/api/v1` by default. Start SQL Server and the backend
(`mvn spring-boot:run` from `backend`) before using these forms. The backend's
database connection is configured in `backend/src/main/resources/application.properties`.

If the backend uses a different address, set `VITE_API_BASE_URL` in a local
`.env.local` file, including the `/api/v1` path, for example:

```env
VITE_API_BASE_URL=http://localhost:8080/api/v1
```

Registration creates an active `MEMBER` in the `users` table, and sign-in
validates the submitted email address or phone number and password against that
table.

## Booking browser tests

With the local SQL Server available, run the browser end-to-end suite from this
directory:

```bash
npm run test:e2e
```

Playwright starts the Spring Boot API and Vite app when they are not already
running. The suite registers a uniquely named test member and creates SANDBOX
court and class bookings in the configured database when an upcoming class has
an available seat; those database records are intentionally retained for
inspection. If no bookable class exists, the class test verifies the database
empty/full state and is reported as skipped instead of inventing a class or
schedule.

## Public home-page content

The home page and the `/sports` and `/facilities` pages load their content from
the Spring Boot API endpoints `/api/v1/public/content/sports` and
`/api/v1/public/content/facilities`. On backend startup, `backend/src/main/resources/schema.sql`
creates the `public_sports` and `public_facilities` tables if needed and inserts
the initial public content only when its slug is not already present. The SQL
Server account configured for the backend therefore needs permission to create
tables the first time the backend starts.

# Inbound Call Center Performance Dashboard

Full-stack dashboard for importing inbound CDR CSV files into MySQL and analyzing call-center performance with live filters, KPIs, charts, agent analytics, executive summaries, and recommendations.

## Stack

- Frontend: React, Vite, Material UI, Recharts
- Backend: Node.js, Express
- Database: MySQL
- CSV import: Multer, csv-parser

## Project Structure

```text
inbound-call-center-dashboard/
  backend/
    src/
      config/
      controllers/
      middleware/
      routes/
      services/
      utils/
  database/
    schema.sql
  frontend/
    src/
      components/
      services/
      theme/
```

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create the MySQL database and table:

```bash
mysql -u root -p < database/schema.sql
```

3. Create `.env` from `.env.example` and update the MySQL settings:

```bash
cp .env.example .env
```

PowerShell:

```powershell
Copy-Item .env.example .env
```

4. Start the backend and frontend:

```bash
npm run dev
```

The API runs at `http://localhost:5000` and the dashboard runs at `http://localhost:5173`.

## CSV Format

The upload endpoint expects a CSV with these columns:

```text
DID No, Group Name, Called No, Call Time, Ring Duration, IVR Duration, Queue Duration, Agent Duration, Hold Duration, Duration, Call End, Agent, Call Type, ACD, Disposition, Sub Disposition
```

Example values include `Sachis Inbound-801`, `Appointment-803`, `PDDU-804`, `Not Connected`, `PMJAY Query`, and `Incoming`.

## Business Rules

Connected call:

```text
Agent Duration > 0 OR Disposition != 'Not Connected'
```

Not connected call:

```text
Disposition = 'Not Connected'
```

Shift calculation:

```text
Shift 1: 07:00 - 14:59
Shift 2: 15:00 - 22:59
Shift 3: 23:00 - 06:59
```

Duplicate CSV rows are skipped with the unique key:

```text
call_time + called_no + agent_id
```

## API

### `POST /api/upload`

Multipart form-data field:

```text
file
```

Response:

```json
{
  "success": true,
  "totalRows": 1000,
  "insertedRows": 950,
  "skippedRows": 45,
  "failedRows": 5
}
```

### `GET /api/dashboard/filters`

Returns distinct values for years, months, groups, agents, dispositions, sub-dispositions, and shifts.

### `GET /api/dashboard`

Query filters:

```text
year, month, startDate, endDate, groupName, agent, disposition, subDisposition, shift
```

Multi-select filters are comma-separated.

## Dashboard Coverage

- KPI cards: total calls, connected calls, not connected calls, connection rate, missed-call rate, average call duration, average agent duration, average queue duration
- Donut charts: call ending point, disposition distribution, group distribution, calls per shift
- Bar charts: connected by shift, not connected by shift, top sub-dispositions, top agents, bottom agents
- Hourly analysis: incoming calls, connected calls, not connected calls, call drop rate
- Agent analytics: top and bottom 10 agents with total calls, connected calls, connection rate, and average agent duration
- Executive summary, performance issues, and recommendations generated from live values

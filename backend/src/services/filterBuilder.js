import { sql } from "../config/db.js";

const FILTER_MAP = {
  groupName: "group_name",
  agent: "agent_id",
  disposition: "disposition",
  subDisposition: "sub_disposition",
  shift: "shift",
  acd: "acd",
  callType: "call_type"
};

let nextParameterId = 1;

const MONTH_MAP = {
  Jan: 1,
  Feb: 2,
  Mar: 3,
  Apr: 4,
  May: 5,
  Jun: 6,
  Jul: 7,
  Aug: 8,
  Sep: 9,
  Oct: 10,
  Nov: 11,
  Dec: 12
};

function normalizeList(value) {
  if (value === undefined || value === null || value === "") {
    return [];
  }

  const values = Array.isArray(value) ? value : String(value).split(",");
  return values.map((item) => String(item).trim()).filter(Boolean);
}

function addParameter(params, type, value) {
  const name = `filter_${nextParameterId++}`;
  params.push({ name, type, value });
  return `@${name}`;
}

function formatDateTime(date, time) {
  return `${date} ${time}`;
}

export function buildWhereClause(filters = {}, options = {}) {
  const clauses = [];
  const params = [];
  const years = normalizeList(filters.year);

  if (years.length > 0) {
    const placeholders = years.map((year) =>
      addParameter(params, sql.Int, Number(year))
    );
    clauses.push(`YEAR(call_time) IN (${placeholders.join(", ")})`);
  }

  const months = normalizeList(filters.month);

  if (months.length > 0) {
    const placeholders = months.map((month) =>
      addParameter(params, sql.Int, MONTH_MAP[month] || Number(month))
    );
    clauses.push(`MONTH(call_time) IN (${placeholders.join(", ")})`);
  }

  if (filters.startDate) {
    const parameter = addParameter(
      params,
      sql.NVarChar(19),
      formatDateTime(filters.startDate, "00:00:00")
    );
    clauses.push(`call_time >= CONVERT(datetime2(0), ${parameter}, 120)`);
  }

  if (filters.endDate) {
    const parameter = addParameter(
      params,
      sql.NVarChar(19),
      formatDateTime(filters.endDate, "23:59:59")
    );
    clauses.push(`call_time <= CONVERT(datetime2(0), ${parameter}, 120)`);
  }

  Object.entries(FILTER_MAP).forEach(([filterKey, columnName]) => {
    const values = normalizeList(filters[filterKey]);
    if (values.length > 0) {
      const placeholders = values.map((value) =>
        addParameter(params, sql.NVarChar, value)
      );
      clauses.push(`${columnName} IN (${placeholders.join(", ")})`);
    }
  });

  if (options.requireAgent) {
    clauses.push("agent_id IS NOT NULL AND agent_id <> ''");
  }

  const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  return { whereSql, params };
}
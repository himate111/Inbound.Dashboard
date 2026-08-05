const FILTER_MAP = {
  groupName: "group_name",
  agent: "agent_id",
  disposition: "disposition",
  subDisposition: "sub_disposition",
  shift: "shift"
};

function normalizeList(value) {
  if (value === undefined || value === null || value === "") {
    return [];
  }
  const values = Array.isArray(value) ? value : String(value).split(",");
  return values.map((item) => String(item).trim()).filter(Boolean);
}

export function buildWhereClause(filters = {}, options = {}) {
  const clauses = [];
  const params = [];

  const years = normalizeList(filters.year);

if (years.length > 0) {
  clauses.push(
    `YEAR(call_time) IN (${years.map(() => "?").join(",")})`
  );
  params.push(...years.map(Number));
}

 const monthMap = {
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

const months = normalizeList(filters.month);

if (months.length > 0) {
  const monthNumbers = months.map(
    (month) => monthMap[month] || Number(month)
  );

  clauses.push(
    `MONTH(call_time) IN (${monthNumbers.map(() => "?").join(",")})`
  );

  params.push(...monthNumbers);
}

  if (filters.startDate) {
    clauses.push("call_time >= ?");
    params.push(`${filters.startDate} 00:00:00`);
  }

  if (filters.endDate) {
    clauses.push("call_time <= ?");
    params.push(`${filters.endDate} 23:59:59`);
  }

  Object.entries(FILTER_MAP).forEach(([filterKey, columnName]) => {
    const values = normalizeList(filters[filterKey]);
    if (values.length > 0) {
      clauses.push(`${columnName} IN (${values.map(() => "?").join(", ")})`);
      params.push(...values);
    }
  });

  if (options.requireAgent) {
    clauses.push("agent_id IS NOT NULL AND agent_id <> ''");
  }

  const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  return { whereSql, params };
}

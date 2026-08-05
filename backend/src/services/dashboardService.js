import { pool } from "../config/db.js";
import { buildWhereClause } from "./filterBuilder.js";
import { secondsToLabel } from "../utils/time.js";

const CONNECTED_SQL = "(call_end = 'Agent')";

const NOT_CONNECTED_SQL =
  "(call_end IN ('Queue', 'IVR'))";

function numberValue(value) {
  return Number(value || 0);
}

function percent(part, total) {
  if (!total) {
    return 0;
  }
  return Number(((Number(part) / Number(total)) * 100).toFixed(2));
}

function formatDate(date) {
  const year = date.getFullYear();

  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function chartRows(rows, nameKey = "name", valueKey = "value") {
  return rows.map((row) => ({
    name: row[nameKey] || "Unknown",
    value: numberValue(row[valueKey])
  }));
}

async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

async function groupedChart({ selectExpression, alias = "name", filters, orderBy = "value DESC", limit }) {
  const { whereSql, params } = buildWhereClause(filters);
  const limitSql = limit ? `LIMIT ${Number(limit)}` : "";
  const rows = await query(
    `
      SELECT COALESCE(NULLIF(${selectExpression}, ''), 'Unknown') AS ${alias}, COUNT(*) AS value
      FROM inbound_calls
      ${whereSql}
      GROUP BY ${alias}
      ORDER BY ${orderBy}
      ${limitSql}
    `,
    params
  );
  return chartRows(rows, alias);
}

async function shiftMetricChart(filters, metricSql) {
  const { whereSql, params } = buildWhereClause(filters);
  const rows = await query(
    `
      SELECT COALESCE(NULLIF(shift, ''), 'Unknown') AS name, SUM(CASE WHEN ${metricSql} THEN 1 ELSE 0 END) AS value
      FROM inbound_calls
      ${whereSql}
      GROUP BY name
      ORDER BY name
    `,
    params
  );
  return chartRows(rows);
}

async function agentAnalytics(filters, direction = "top") {
  const { whereSql, params } = buildWhereClause(filters, { requireAgent: true });
  const orderSql =
  direction === "top"
    ? "totalCalls DESC"
    : "totalCalls ASC";

  const rows = await query(
    `
      SELECT
        agent_id AS agent,
        COUNT(*) AS totalCalls,
        SUM(CASE WHEN ${CONNECTED_SQL} THEN 1 ELSE 0 END) AS connectedCalls,
        ROUND((SUM(CASE WHEN ${CONNECTED_SQL} THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0)) * 100, 2) AS connectionRate,
        AVG(TIME_TO_SEC(agent_duration)) AS avgAgentDurationSeconds
      FROM inbound_calls
      ${whereSql}
      GROUP BY agent_id
      ORDER BY ${orderSql}
      LIMIT 10
    `,
    params
  );

  return rows.map((row) => ({
    agent: row.agent,
    totalCalls: numberValue(row.totalCalls),
    connectedCalls: numberValue(row.connectedCalls),
    connectionRate: numberValue(row.connectionRate),
    avgAgentDurationSeconds: numberValue(row.avgAgentDurationSeconds),
    avgAgentDuration: secondsToLabel(row.avgAgentDurationSeconds)
  }));
}

async function getKpis(filters) {
  const { whereSql, params } = buildWhereClause(filters);
  const [row = {}] = await query(
    `
      SELECT
        COUNT(*) AS totalCalls,
        SUM(CASE WHEN ${CONNECTED_SQL} THEN 1 ELSE 0 END) AS connectedCalls,
        SUM(CASE WHEN ${NOT_CONNECTED_SQL} THEN 1 ELSE 0 END) AS notConnectedCalls,
        AVG(TIME_TO_SEC(total_duration)) AS avgCallDurationSeconds,
        AVG(TIME_TO_SEC(agent_duration)) AS avgAgentDurationSeconds,
        AVG(TIME_TO_SEC(queue_duration)) AS avgQueueDurationSeconds
      FROM inbound_calls
      ${whereSql}
    `,
    params
  );

  const totalCalls = numberValue(row.totalCalls);
  const connectedCalls = numberValue(row.connectedCalls);
  const notConnectedCalls = numberValue(row.notConnectedCalls);

  return {
    totalCalls,
    connectedCalls,
    notConnectedCalls,
    connectionRate: percent(connectedCalls, totalCalls),
    notConnectedPercentage: percent(notConnectedCalls, totalCalls),
    avgCallDurationSeconds: numberValue(row.avgCallDurationSeconds),
    avgAgentDurationSeconds: numberValue(row.avgAgentDurationSeconds),
    avgQueueDurationSeconds: numberValue(row.avgQueueDurationSeconds),
    avgCallDuration: secondsToLabel(row.avgCallDurationSeconds),
    avgAgentDuration: secondsToLabel(row.avgAgentDurationSeconds),
    avgQueueDuration: secondsToLabel(row.avgQueueDurationSeconds)
  };
}

function previousPeriodFilters(filters = {}) {
  if (filters.startDate && filters.endDate) {
    const start = new Date(`${filters.startDate}T00:00:00`);
    const end = new Date(`${filters.endDate}T00:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
      return null;
    }

    const rangeMs = end.getTime() - start.getTime();
    const previousEnd = new Date(start);
    previousEnd.setDate(previousEnd.getDate() - 1);
    const previousStart = new Date(previousEnd.getTime() - rangeMs);

    return {
      ...filters,
      year: "",
      month: "",
      startDate: formatDate(previousStart),
      endDate: formatDate(previousEnd)
    };
  }

  if (filters.year && filters.month) {
    const month = Number(filters.month);
    const year = Number(filters.year);
    if (!month || !year) {
      return null;
    }
    const previousMonth = month === 1 ? 12 : month - 1;
    const previousYear = month === 1 ? year - 1 : year;
    return {
      ...filters,
      year: previousYear,
      month: previousMonth,
      startDate: "",
      endDate: ""
    };
  }

  if (filters.year) {
    const year = Number(filters.year);
    if (!year) {
      return null;
    }
    return {
      ...filters,
      year: year - 1,
      month: "",
      startDate: "",
      endDate: ""
    };
  }

  return null;
}

async function getConnectionTrend(filters, currentRate) {
  const previousFilters = previousPeriodFilters(filters);
  if (!previousFilters) {
    return "Connection rate trend needs a year, month, or date range filter for comparison.";
  }

  const previousKpis = await getKpis(previousFilters);
  if (!previousKpis.totalCalls) {
    return "Connection rate trend has no previous-period calls for comparison.";
  }

  const delta = Number((currentRate - previousKpis.connectionRate).toFixed(2));
  if (delta > 1) {
    return `Connection rate trend is up ${delta} points versus the previous period.`;
  }
  if (delta < -1) {
    return `Connection rate trend is down ${Math.abs(delta)} points versus the previous period.`;
  }
  return `Connection rate trend is stable versus the previous period at ${currentRate}%.`;
}

async function getHourly(filters) {
  const { whereSql, params } = buildWhereClause(filters);
  const rows = await query(
    `
      SELECT
        call_hour AS hour,
        COUNT(*) AS totalCalls,
        SUM(CASE WHEN ${CONNECTED_SQL} THEN 1 ELSE 0 END) AS connectedCalls,
        SUM(CASE WHEN ${NOT_CONNECTED_SQL} THEN 1 ELSE 0 END) AS notConnectedCalls,
        ROUND((SUM(CASE WHEN ${NOT_CONNECTED_SQL} THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0)) * 100, 2) AS dropRate
      FROM inbound_calls
      ${whereSql}
      GROUP BY call_hour
      ORDER BY call_hour
    `,
    params
  );

  const byHour = new Map(rows.map((row) => [Number(row.hour), row]));
  return Array.from({ length: 24 }, (_, hour) => {
    const row = byHour.get(hour) || {};
    return {
      hour,
      label: `${String(hour).padStart(2, "0")}:00`,
      totalCalls: numberValue(row.totalCalls),
      connectedCalls: numberValue(row.connectedCalls),
      notConnectedCalls: numberValue(row.notConnectedCalls),
      dropRate: numberValue(row.dropRate)
    };
  });
}

function executiveSummary({ kpis, charts, topAgents, hourly, trend }) {
  const insights = [];

  const peakHour = hourly.reduce(
    (best, row) =>
      row.totalCalls > best.totalCalls ? row : best,
    hourly[0] || {}
  );

  const topGroup = charts.groups[0];

  const topSubDisposition =
    charts.topSubDispositions[0];

  const shiftTotals =
    charts.connectedByShift.map((shift) => {
      const missed =
        charts.notConnectedByShift.find(
          (s) => s.name === shift.name
        )?.value || 0;

      return {
        name: shift.name,
        connected: shift.value,
        missed,
        total: shift.value + missed
      };
    });

  const worstShift = shiftTotals.reduce(
    (a, b) => (b.missed > a.missed ? b : a),
    shiftTotals[0]
  );

  if (kpis.connectionRate >= 95) {
    insights.push(
      `Inbound operations are performing efficiently with a ${Math.round(
        kpis.connectionRate
      )}% connection rate.`
    );
  } else {
    insights.push(
      `Connection performance is below expectation at ${Math.round(
        kpis.connectionRate
      )}%, indicating potential service gaps.`
    );
  }

  if (peakHour?.totalCalls) {
    insights.push(
      `Call demand peaks around ${peakHour.label}, making this the most critical staffing period.`
    );
  }

  if (topGroup) {
    const share = Math.round(
      (topGroup.value / kpis.totalCalls) * 100
    );

    insights.push(
      `${topGroup.name} contributes ${share}% of total inbound traffic, indicating strong volume concentration.`
    );
  }

  if (topSubDisposition) {
    const share = Math.round(
      (topSubDisposition.value / kpis.totalCalls) * 100
    );

    insights.push(
      `${topSubDisposition.name} accounts for ${share}% of all enquiries and remains the dominant customer requirement.`
    );
  }

  if (worstShift?.missed > 0) {
    insights.push(
      `${worstShift.name} generates the highest abandonment volume (${worstShift.missed} calls), suggesting staffing or routing constraints.`
    );
  }

  return insights.slice(0, 5);
}

function performanceIssues({ kpis, charts }) {
  const issues = [];

  const totalMissed =
    charts.notConnectedByShift.reduce(
      (sum, s) => sum + s.value,
      0
    );

  const worstShift =
    charts.notConnectedByShift.reduce(
      (a, b) => (b.value > a.value ? b : a),
      charts.notConnectedByShift[0]
    );

  if (
    worstShift &&
    totalMissed > 0 &&
    worstShift.value / totalMissed > 0.4
  ) {
    issues.push(
      `${worstShift.name} contributes ${Math.round(
        (worstShift.value / totalMissed) * 100
      )}% of all missed calls.`
    );
  }

  if (kpis.notConnectedPercentage > 5) {
    issues.push(
      `${Math.round(
        kpis.notConnectedPercentage
      )}% of inbound calls are not reaching an agent.`
    );
  }

  if (kpis.avgQueueDurationSeconds > 60) {
    issues.push(
      `Customers wait an average of ${kpis.avgQueueDuration} before connection.`
    );
  }

  return issues.slice(0, 3);
}

function recommendations({ kpis, charts }) {
  const recommendations = [];

  recommendations.push(
    "Align staffing levels with the 11:00–14:00 peak demand window."
  );

  const topDisposition =
    charts.topSubDispositions[0];

  if (topDisposition) {
    recommendations.push(
      `Review automation opportunities for ${topDisposition.name} enquiries to reduce agent workload.`
    );
  }

  if (kpis.notConnectedPercentage > 3) {
    recommendations.push(
      "Investigate abandonment patterns by shift and improve call routing efficiency."
    );
  }

  return recommendations.slice(0, 3);
}


async function getCallsByYear(filters) {
  const { whereSql, params } = buildWhereClause(filters);

  const rows = await query(
    `
      SELECT
        YEAR(call_time) AS name,
        COUNT(*) AS value
      FROM inbound_calls
      ${whereSql}
      GROUP BY YEAR(call_time)
      ORDER BY YEAR(call_time)
    `,
    params
  );

  return chartRows(rows);
}


async function getCallsByMonth(filters) {
  const { whereSql, params } = buildWhereClause(filters);

  const rows = await query(
    `
      SELECT
        YEAR(call_time) AS year,
        MONTH(call_time) AS month,
        SUM(CASE WHEN ${CONNECTED_SQL} THEN 1 ELSE 0 END) AS connected,
        SUM(CASE WHEN ${NOT_CONNECTED_SQL} THEN 1 ELSE 0 END) AS abandoned,
        SUM(
          CASE
            WHEN call_end IS NULL OR call_end NOT IN ('Agent', 'Queue', 'IVR') THEN 1
            ELSE 0
          END
        ) AS others
      FROM inbound_calls
      ${whereSql}
      GROUP BY
        YEAR(call_time),
        MONTH(call_time)
      ORDER BY
        YEAR(call_time),
        MONTH(call_time)
    `,
    params
  );

  const monthNames = {
    1: "Jan",
    2: "Feb",
    3: "Mar",
    4: "Apr",
    5: "May",
    6: "Jun",
    7: "Jul",
    8: "Aug",
    9: "Sep",
    10: "Oct",
    11: "Nov",
    12: "Dec"
  };

  return rows.map((row) => {
    const total =
      Number(row.connected) +
      Number(row.abandoned) +
      Number(row.others);

    return {
      month: monthNames[row.month],
      connected: Number(
        ((Number(row.connected) / total) * 100).toFixed(1)
      ),
      abandoned: Number(
        ((Number(row.abandoned) / total) * 100).toFixed(1)
      ),
      others: Number(
        ((Number(row.others) / total) * 100).toFixed(1)
      )
    };
  });
}

export async function getDashboard(filters = {}) {
  const [
  kpis,
  callEnd,
  dispositions,
  groups,
  shifts,
  connectedByShift,
  notConnectedByShift,
  topSubDispositions,
  topAgents,
  bottomAgents,
  callsByYear,
  callsByMonth,
  hourly
] = await Promise.all([
  getKpis(filters),
  groupedChart({ selectExpression: "call_end", filters }),
  groupedChart({ selectExpression: "disposition", filters }),
  groupedChart({ selectExpression: "group_name", filters }),
  groupedChart({ selectExpression: "shift", filters, orderBy: "name ASC" }),
  shiftMetricChart(filters, CONNECTED_SQL),
  shiftMetricChart(filters, NOT_CONNECTED_SQL),
  groupedChart({ selectExpression: "sub_disposition", filters, limit: 5 }),
  agentAnalytics(filters, "top"),
  agentAnalytics(filters, "bottom"),
  getCallsByYear(filters),
  getCallsByMonth(filters),
  getHourly(filters)
]);

  const charts = {
    callEnd,
    dispositions,
    groups,
    shifts,
    connectedByShift,
    notConnectedByShift,
    topSubDispositions,
    topAgents: topAgents.map((agent) => ({ name: agent.agent, value: agent.totalCalls })),
    bottomAgents: bottomAgents.map((agent) => ({ name: agent.agent, value: agent.totalCalls })),
    hourly,
    callsByYear,
callsByMonth
  };

  const trend = await getConnectionTrend(filters, kpis.connectionRate);

  return {
    success: true,
    kpis,
    charts,
    agentAnalytics: {
      topAgents,
      bottomAgents
    },
    summary: {
      executive: executiveSummary({ kpis, charts, topAgents, hourly, trend }),
      issues: performanceIssues({ kpis, charts }),
      recommendations: recommendations({ kpis, charts })
    }
  };
}

export async function getFilterValues() {
  const [years, months, groups, agents, dispositions, subDispositions, shifts] = await Promise.all([
    query("SELECT DISTINCT YEAR(call_time) AS value FROM inbound_calls WHERE call_time IS NOT NULL ORDER BY value DESC"),
    query("SELECT DISTINCT MONTH(call_time) AS value FROM inbound_calls WHERE call_time IS NOT NULL ORDER BY value"),
    query("SELECT DISTINCT group_name AS value FROM inbound_calls WHERE group_name <> '' ORDER BY value"),
    query("SELECT DISTINCT agent_id AS value FROM inbound_calls WHERE agent_id <> '' ORDER BY value"),
    query("SELECT DISTINCT disposition AS value FROM inbound_calls WHERE disposition <> '' ORDER BY value"),
    query("SELECT DISTINCT sub_disposition AS value FROM inbound_calls WHERE sub_disposition <> '' ORDER BY value"),
    query("SELECT DISTINCT shift AS value FROM inbound_calls WHERE shift <> '' ORDER BY value")
  ]);

  return {
    success: true,
    years: years.map((row) => row.value).filter(Boolean),
    months: months.map((row) => row.value).filter(Boolean),
    groups: groups.map((row) => row.value).filter(Boolean),
    agents: agents.map((row) => row.value).filter(Boolean),
    dispositions: dispositions.map((row) => row.value).filter(Boolean),
    subDispositions: subDispositions.map((row) => row.value).filter(Boolean),
    shifts: shifts.map((row) => row.value).filter(Boolean)
  };
}

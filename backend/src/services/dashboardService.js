import { pool } from "../config/db.js";
import { buildWhereClause } from "./filterBuilder.js";
import { secondsToLabel } from "../utils/time.js";
import { runWithGlobalSqlConcurrency } from "./sqlQueryLimiter.js";

const CONNECTED_SQL = "(call_end = 'Agent')";

const NOT_CONNECTED_SQL =
  "(call_end IN ('Queue', 'IVR'))";

const CONNECTED_THRESHOLD_SECONDS = 3;

const SAFE_AGENT_DURATION_SECONDS_SQL = `
  CASE
    WHEN agent_duration IS NULL THEN NULL
    ELSE DATEDIFF(SECOND, CAST('00:00:00' AS time), agent_duration)
  END
`;

const AGENT_DURATION_CONNECTED_SQL =
  `(${SAFE_AGENT_DURATION_SECONDS_SQL} >= ${CONNECTED_THRESHOLD_SECONDS})`;

const AGENT_DURATION_ABANDONED_SQL =
  `(${SAFE_AGENT_DURATION_SECONDS_SQL} < ${CONNECTED_THRESHOLD_SECONDS})`;

const AGENT_DURATION_UNCLASSIFIED_SQL =
  `(${SAFE_AGENT_DURATION_SECONDS_SQL} IS NULL)`;

function numberValue(value) {
  return Number(value || 0);
}

function percent(part, total) {
  if (!total) {
    return 0;
  }
  return Number(((Number(part) / Number(total)) * 100).toFixed(2));
}

function percentLabel(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function isPlaceholder(value) {
  const normalized = String(value ?? "").trim().toUpperCase();
  return !normalized || ["-", "N/A", "NA", "UNKNOWN"].includes(normalized);
}

function placeholderSql(column) {
  return `(
    ${column} IS NULL
    OR LTRIM(RTRIM(${column})) = ''
    OR UPPER(LTRIM(RTRIM(${column}))) IN ('-', 'N/A', 'NA', 'UNKNOWN')
  )`;
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

async function query(queryText, params = []) {
  return runWithGlobalSqlConcurrency(async () => {
    const request = pool.request();

    params.forEach(({ name, type, value }) => {
      request.input(name, type, value);
    });

    const result = await request.query(queryText);
    return result.recordset;
  });
}

async function groupedChart({ selectExpression, alias = "name", filters, orderBy = "value DESC", limit }) {
  const { whereSql, params } = buildWhereClause(filters);
  const topSql = limit ? `TOP (${Number(limit)}) ` : "";
  const groupExpression = `COALESCE(NULLIF(${selectExpression}, ''), 'Unknown')`;
  const rows = await query(
    `
      SELECT ${topSql}${groupExpression} AS ${alias}, COUNT(*) AS value
      FROM dbo.inbound_calls
      ${whereSql}
      GROUP BY ${groupExpression}
      ORDER BY ${orderBy}
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
      FROM dbo.inbound_calls
      ${whereSql}
      GROUP BY COALESCE(NULLIF(shift, ''), 'Unknown')
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
      SELECT TOP (10)
        agent_id AS agent,
        COUNT(*) AS totalCalls,
        SUM(CASE WHEN ${CONNECTED_SQL} THEN 1 ELSE 0 END) AS connectedCalls,
        ROUND((100.0 * SUM(CASE WHEN ${CONNECTED_SQL} THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0)), 2) AS connectionRate,
        AVG(DATEDIFF(SECOND, CAST('00:00:00' AS time), agent_duration)) AS avgAgentDurationSeconds
      FROM dbo.inbound_calls
      ${whereSql}
      GROUP BY agent_id
      ORDER BY ${orderSql}
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
        SUM(CASE WHEN ${AGENT_DURATION_CONNECTED_SQL} THEN 1 ELSE 0 END) AS connectedCalls,
        SUM(CASE WHEN ${AGENT_DURATION_ABANDONED_SQL} THEN 1 ELSE 0 END) AS notConnectedCalls,
        AVG(DATEDIFF(SECOND, CAST('00:00:00' AS time), total_duration)) AS avgCallDurationSeconds,
        AVG(DATEDIFF(SECOND, CAST('00:00:00' AS time), agent_duration)) AS avgAgentDurationSeconds,
        AVG(DATEDIFF(SECOND, CAST('00:00:00' AS time), queue_duration)) AS avgQueueDurationSeconds
      FROM dbo.inbound_calls
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
        ROUND((100.0 * SUM(CASE WHEN ${NOT_CONNECTED_SQL} THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0)), 2) AS dropRate
      FROM dbo.inbound_calls
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

async function getSummaryShiftMetrics(filters) {
  const { whereSql, params } = buildWhereClause(filters);
  const rows = await query(
    `
      SELECT
        COALESCE(NULLIF(shift, ''), 'Unknown') AS name,
        COUNT(*) AS totalCalls,
        SUM(CASE WHEN ${AGENT_DURATION_CONNECTED_SQL} THEN 1 ELSE 0 END) AS connectedCalls,
        SUM(CASE WHEN ${AGENT_DURATION_ABANDONED_SQL} THEN 1 ELSE 0 END) AS abandonedCalls,
        SUM(CASE WHEN ${AGENT_DURATION_UNCLASSIFIED_SQL} THEN 1 ELSE 0 END) AS unclassifiedCalls
      FROM dbo.inbound_calls
      ${whereSql}
      GROUP BY COALESCE(NULLIF(shift, ''), 'Unknown')
      ORDER BY name
    `,
    params
  );

  return rows.map((row) => {
    const totalCalls = numberValue(row.totalCalls);
    const abandonedCalls = numberValue(row.abandonedCalls);
    return {
      name: row.name || "Unknown",
      totalCalls,
      connectedCalls: numberValue(row.connectedCalls),
      abandonedCalls,
      unclassifiedCalls: numberValue(row.unclassifiedCalls),
      abandonmentRate: percent(abandonedCalls, totalCalls)
    };
  });
}

async function getDataQualityMetrics(filters) {
  const { whereSql, params } = buildWhereClause(filters);
  const [row = {}] = await query(
    `
      SELECT
        COUNT(*) AS totalCalls,
        SUM(CASE WHEN ${placeholderSql("disposition")} THEN 1 ELSE 0 END) AS invalidDispositionCount,
        SUM(CASE WHEN ${placeholderSql("sub_disposition")} THEN 1 ELSE 0 END) AS invalidSubDispositionCount,
        SUM(CASE WHEN ${placeholderSql("agent_id")} THEN 1 ELSE 0 END) AS invalidAgentIdCount,
        SUM(CASE WHEN ${placeholderSql("group_name")} THEN 1 ELSE 0 END) AS invalidGroupNameCount,
        SUM(CASE WHEN ${SAFE_AGENT_DURATION_SECONDS_SQL} IS NULL THEN 1 ELSE 0 END) AS missingAgentDurationCount,
        SUM(CASE WHEN total_duration IS NULL THEN 1 ELSE 0 END) AS missingTotalDurationCount,
        SUM(CASE WHEN DATEDIFF(SECOND, CAST('00:00:00' AS time), agent_duration) < 0 THEN 1 ELSE 0 END) AS negativeAgentDurationCount,
        SUM(CASE WHEN DATEDIFF(SECOND, CAST('00:00:00' AS time), total_duration) < 0 THEN 1 ELSE 0 END) AS negativeTotalDurationCount,
        SUM(CASE WHEN ${SAFE_AGENT_DURATION_SECONDS_SQL} IS NOT NULL AND total_duration IS NOT NULL AND DATEDIFF(SECOND, CAST('00:00:00' AS time), agent_duration) > DATEDIFF(SECOND, CAST('00:00:00' AS time), total_duration) THEN 1 ELSE 0 END) AS agentDurationExceedsTotalCount,
        SUM(CASE WHEN ${AGENT_DURATION_ABANDONED_SQL} AND call_end = 'Agent' THEN 1 ELSE 0 END) AS durationAbandonedAgentEndCount,
        SUM(CASE WHEN ${AGENT_DURATION_CONNECTED_SQL} AND (call_end IS NULL OR call_end <> 'Agent') THEN 1 ELSE 0 END) AS durationConnectedNonAgentEndCount
      FROM dbo.inbound_calls
      ${whereSql}
    `,
    params
  );

  const totalCalls = numberValue(row.totalCalls);
  const quality = {
    totalCalls,
    invalidDispositionCount: numberValue(row.invalidDispositionCount),
    invalidSubDispositionCount: numberValue(row.invalidSubDispositionCount),
    invalidAgentIdCount: numberValue(row.invalidAgentIdCount),
    invalidGroupNameCount: numberValue(row.invalidGroupNameCount),
    missingAgentDurationCount: numberValue(row.missingAgentDurationCount),
    missingTotalDurationCount: numberValue(row.missingTotalDurationCount),
    negativeAgentDurationCount: numberValue(row.negativeAgentDurationCount),
    negativeTotalDurationCount: numberValue(row.negativeTotalDurationCount),
    agentDurationExceedsTotalCount: numberValue(row.agentDurationExceedsTotalCount),
    durationAbandonedAgentEndCount: numberValue(row.durationAbandonedAgentEndCount),
    durationConnectedNonAgentEndCount: numberValue(row.durationConnectedNonAgentEndCount)
  };

  return {
    ...quality,
    invalidDispositionPercentage: percent(quality.invalidDispositionCount, totalCalls),
    invalidSubDispositionPercentage: percent(quality.invalidSubDispositionCount, totalCalls),
    invalidAgentIdPercentage: percent(quality.invalidAgentIdCount, totalCalls),
    invalidGroupNamePercentage: percent(quality.invalidGroupNameCount, totalCalls)
  };
}

async function getSummaryMetrics(filters, kpis, charts, hourly) {
  const [shifts, dataQuality] = await Promise.all([
    getSummaryShiftMetrics(filters),
    getDataQualityMetrics(filters)
  ]);
  const peakHour = hourly.reduce(
    (best, row) => (row.totalCalls > best.totalCalls ? row : best),
    hourly[0] || {}
  );
  const topGroup = charts.groups.find((group) => !isPlaceholder(group.name));
  const topSubDisposition = charts.topSubDispositions.find(
    (item) => !isPlaceholder(item.name)
  );
  const highestAbandonmentRateShift = shifts.reduce(
    (best, shift) => !best || shift.abandonmentRate > best.abandonmentRate ? shift : best,
    null
  );

  return {
    kpis,
    peakHour,
    peakHourShare: percent(peakHour?.totalCalls, kpis.totalCalls),
    topGroup,
    topGroupShare: percent(topGroup?.value, kpis.totalCalls),
    topSubDisposition,
    meaningfulSubDispositionCoverage: 100 - dataQuality.invalidSubDispositionPercentage,
    highestAbandonmentRateShift,
    dataQuality
  };
}

function buildInsights(metrics) {
  const insights = [];
  const { kpis, peakHour, peakHourShare, topGroup, topGroupShare, topSubDisposition, meaningfulSubDispositionCoverage, highestAbandonmentRateShift } = metrics;

  if (kpis.totalCalls > 0) {
    if (kpis.connectionRate >= 95) {
      insights.push(`${percentLabel(kpis.connectionRate)} of ${kpis.totalCalls.toLocaleString()} customer calls were connected, showing strong service performance.`);
    } else if (kpis.connectionRate >= 90) {
      insights.push(`${percentLabel(kpis.connectionRate)} of customer calls were connected. Performance is healthy, with an opportunity to reduce calls that end early.`);
    } else {
      insights.push(`${percentLabel(kpis.connectionRate)} of customer calls were connected, highlighting an opportunity to improve call completion.`);
    }
  }
  if (peakHour?.totalCalls > 0) {
    insights.push(`Customer call demand was highest at ${peakHour.label}, with ${peakHour.totalCalls.toLocaleString()} calls (${percentLabel(peakHourShare)} of all calls).`);
  }
  if (topGroup) {
    insights.push(topGroupShare >= 60
      ? `${topGroup.name} handled ${percentLabel(topGroupShare)} of customer calls, making it the main inbound group for this period.`
      : `Customer calls were shared across inbound groups, with ${topGroup.name} handling the largest share at ${percentLabel(topGroupShare)}.`);
  }
  if (highestAbandonmentRateShift?.totalCalls > 0 && highestAbandonmentRateShift.abandonedCalls > 0) {
    insights.push(`${highestAbandonmentRateShift.name} had the highest rate of calls ending early at ${percentLabel(highestAbandonmentRateShift.abandonmentRate)} (${highestAbandonmentRateShift.abandonedCalls.toLocaleString()} calls).`);
  }
  if (topSubDisposition && meaningfulSubDispositionCoverage >= 50) {
    insights.push(`${topSubDisposition.name} was the most common recorded reason for contact, representing ${percentLabel(percent(topSubDisposition.value, kpis.totalCalls))} of calls.`);
  }
  return insights.slice(0, 5);
}

function buildPerformanceIssues(metrics) {
  const issues = [];
  const { kpis, topGroupShare, highestAbandonmentRateShift } = metrics;

  if (kpis.notConnectedPercentage > 5) {
    issues.push(`${percentLabel(kpis.notConnectedPercentage)} of calls ended early, which is above the preferred service range.`);
  } else if (kpis.notConnectedPercentage > 3) {
    issues.push(`${percentLabel(kpis.notConnectedPercentage)} of calls ended early. This is elevated and should be monitored.`);
  }
  if (highestAbandonmentRateShift && highestAbandonmentRateShift.abandonmentRate >= kpis.notConnectedPercentage + 1) {
    issues.push(`${highestAbandonmentRateShift.name} had ${percentLabel(highestAbandonmentRateShift.abandonmentRate)} of calls end early, compared with ${percentLabel(kpis.notConnectedPercentage)} overall. This indicates a service issue during that shift.`);
  }
  if (kpis.avgQueueDurationSeconds > 60) {
    issues.push(`Customers waited an average of ${kpis.avgQueueDuration} before reaching an agent, which may affect their experience.`);
  } else if (kpis.avgQueueDurationSeconds >= 30) {
    issues.push(`Customers waited an average of ${kpis.avgQueueDuration} before reaching an agent. This is elevated and should be monitored.`);
  }
  if (topGroupShare >= 60) {
    issues.push(`A large share of customer calls (${percentLabel(topGroupShare)}) is handled by a single inbound group. Monitoring this workload can help avoid service disruption.`);
  }
  return issues.slice(0, 3);
}

function buildDataQualityObservations(dataQuality) {
  const observations = [];
  const disagreementCount = dataQuality.durationAbandonedAgentEndCount + dataQuality.durationConnectedNonAgentEndCount;
  const durationIssueCount = dataQuality.missingAgentDurationCount + dataQuality.missingTotalDurationCount + dataQuality.negativeAgentDurationCount + dataQuality.negativeTotalDurationCount + dataQuality.agentDurationExceedsTotalCount;

  if (disagreementCount > 0) observations.push(`${disagreementCount.toLocaleString()} calls contain inconsistent information between call status and agent talk time. Reviewing these records will improve reporting accuracy.`);
  if (dataQuality.invalidDispositionCount > 0) observations.push(`The call outcome has not been recorded clearly for ${percentLabel(dataQuality.invalidDispositionPercentage)} of records, which limits outcome analysis.`);
  if (dataQuality.invalidSubDispositionCount > 0) observations.push(`The reason for the customer contact has not been recorded clearly for ${percentLabel(dataQuality.invalidSubDispositionPercentage)} of calls, limiting insight into customer needs.`);
  if (dataQuality.invalidAgentIdCount > 0) observations.push(`Agent information is missing for ${percentLabel(dataQuality.invalidAgentIdPercentage)} of records, which may affect agent performance reporting.`);
  if (dataQuality.invalidGroupNameCount > 0) observations.push(`Inbound group information is missing for ${percentLabel(dataQuality.invalidGroupNamePercentage)} of records.`);
  if (durationIssueCount > 0) observations.push(`${durationIssueCount.toLocaleString()} records have incomplete or inconsistent call timing information and should be reviewed.`);
  return observations.slice(0, 4);
}

function buildRecommendations(metrics) {
  const recommendations = [];
  const { kpis, peakHour, peakHourShare, topGroupShare, highestAbandonmentRateShift, dataQuality } = metrics;
  const disagreementCount = dataQuality.durationAbandonedAgentEndCount + dataQuality.durationConnectedNonAgentEndCount;

  if (disagreementCount > 0) recommendations.push(`Review the ${disagreementCount.toLocaleString()} calls where call information does not match, so reports accurately reflect customer interactions.`);
  if (dataQuality.invalidSubDispositionPercentage >= 10) {
    recommendations.push(`The reason for many customer calls has not been recorded. Capturing this information consistently will provide more meaningful operational insight for the ${percentLabel(dataQuality.invalidSubDispositionPercentage)} of affected records.`);
  } else if (dataQuality.invalidDispositionPercentage >= 10) {
    recommendations.push(`The outcome of many customer calls has not been recorded clearly. Improving this for the ${percentLabel(dataQuality.invalidDispositionPercentage)} of affected records will strengthen performance reporting.`);
  }
  if (kpis.notConnectedPercentage > 3) recommendations.push(`Review staffing and call handling during the periods contributing most to the ${percentLabel(kpis.notConnectedPercentage)} of calls ending early.`);
  if (highestAbandonmentRateShift && highestAbandonmentRateShift.abandonmentRate >= kpis.notConnectedPercentage + 1) recommendations.push(`Prioritise ${highestAbandonmentRateShift.name} for a staffing and call-handling review. ${percentLabel(highestAbandonmentRateShift.abandonmentRate)} of its calls ended early, compared with ${percentLabel(kpis.notConnectedPercentage)} overall.`);
  if (topGroupShare >= 60) recommendations.push(`Most customer calls are handled by one inbound group. Ensuring this group has adequate staffing will help maintain service levels during busy periods.`);
  if (peakHour?.totalCalls > 0 && peakHourShare >= 10) recommendations.push(`Plan staffing around the ${peakHour.label} peak, when ${peakHour.totalCalls.toLocaleString()} calls were received (${percentLabel(peakHourShare)} of all calls).`);
  if (!recommendations.length && kpis.totalCalls > 0) recommendations.push(`Maintain the current service approach while monitoring the ${percentLabel(kpis.notConnectedPercentage)} of calls ending early and demand around ${peakHour?.label || "the busiest hour"}.`);
  return recommendations.slice(0, 4);
}


async function getCallsByYear(filters) {
  const { whereSql, params } = buildWhereClause(filters);

  const rows = await query(
    `
      SELECT
        YEAR(call_time) AS name,
        COUNT(*) AS value
      FROM dbo.inbound_calls
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
        SUM(CASE WHEN ${AGENT_DURATION_CONNECTED_SQL} THEN 1 ELSE 0 END) AS connected,
        SUM(CASE WHEN ${AGENT_DURATION_ABANDONED_SQL} THEN 1 ELSE 0 END) AS abandoned,
        SUM(CASE WHEN ${AGENT_DURATION_UNCLASSIFIED_SQL} THEN 1 ELSE 0 END) AS others
      FROM dbo.inbound_calls
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

async function runWithConcurrency(tasks, concurrencyLimit) {
  const results = new Array(tasks.length);
  let nextTaskIndex = 0;

  async function worker() {
    while (nextTaskIndex < tasks.length) {
      const taskIndex = nextTaskIndex;
      nextTaskIndex += 1;
      results[taskIndex] = await tasks[taskIndex]();
    }
  }

  const workerCount = Math.min(concurrencyLimit, tasks.length);
  await Promise.all(Array.from({ length: workerCount }, worker));

  return results;
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
] = await runWithConcurrency([
  () => getKpis(filters),
  () => groupedChart({ selectExpression: "call_end", filters }),
  () => groupedChart({ selectExpression: "disposition", filters }),
  () => groupedChart({ selectExpression: "group_name", filters }),
  () => groupedChart({ selectExpression: "shift", filters, orderBy: "name ASC" }),
  () => shiftMetricChart(filters, CONNECTED_SQL),
  () => shiftMetricChart(filters, NOT_CONNECTED_SQL),
  () => groupedChart({ selectExpression: "sub_disposition", filters, limit: 5 }),
  () => agentAnalytics(filters, "top"),
  () => agentAnalytics(filters, "bottom"),
  () => getCallsByYear(filters),
  () => getCallsByMonth(filters),
  () => getHourly(filters)
], 4);

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

  const summaryMetrics = await getSummaryMetrics(filters, kpis, charts, hourly);

  return {
    success: true,
    kpis,
    charts,
    agentAnalytics: {
      topAgents,
      bottomAgents
    },
    summary: {
      executive: buildInsights(summaryMetrics),
      issues: buildPerformanceIssues(summaryMetrics),
      dataQuality: buildDataQualityObservations(summaryMetrics.dataQuality),
      recommendations: buildRecommendations(summaryMetrics)
    }
  };
}

export async function getFilterValues() {
  const [years, months, groups, agents, dispositions, subDispositions, shifts] = await Promise.all([
    query("SELECT DISTINCT YEAR(call_time) AS value FROM dbo.inbound_calls WHERE call_time IS NOT NULL ORDER BY value DESC"),
    query("SELECT DISTINCT MONTH(call_time) AS value FROM dbo.inbound_calls WHERE call_time IS NOT NULL ORDER BY value"),
    query("SELECT DISTINCT group_name AS value FROM dbo.inbound_calls WHERE group_name <> '' ORDER BY value"),
    query("SELECT DISTINCT agent_id AS value FROM dbo.inbound_calls WHERE agent_id <> '' ORDER BY value"),
    query("SELECT DISTINCT disposition AS value FROM dbo.inbound_calls WHERE disposition <> '' ORDER BY value"),
    query("SELECT DISTINCT sub_disposition AS value FROM dbo.inbound_calls WHERE sub_disposition <> '' ORDER BY value"),
    query("SELECT DISTINCT shift AS value FROM dbo.inbound_calls WHERE shift <> '' ORDER BY value")
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

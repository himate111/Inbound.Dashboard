import { Readable } from "stream";
import fs from "fs";
import csv from "csv-parser";

import { pool, sql } from "../config/db.js";
import { cleanHeader, validateColumns } from "../utils/csvColumns.js";
import { calculateShift, durationToSeconds, parseDateTime, secondsToTime } from "../utils/time.js";

const INSERT_SQL = `
  INSERT INTO dbo.inbound_calls (
    did_no,
    group_name,
    called_no,
    call_time,
    ring_duration,
    ivr_duration,
    queue_duration,
    agent_duration,
    hold_duration,
    total_duration,
    call_end,
    agent_id,
    call_type,
    acd,
    disposition,
    sub_disposition,
    shift,
    call_hour
  )
  SELECT
    @did_no,
    @group_name,
    @called_no,
    CONVERT(datetime2(0), @call_time, 120),
    @ring_duration,
    @ivr_duration,
    @queue_duration,
    @agent_duration,
    @hold_duration,
    @total_duration,
    @call_end,
    @agent_id,
    @call_type,
    @acd,
    @disposition,
    @sub_disposition,
    @shift,
    @call_hour
  WHERE NOT EXISTS (
    SELECT 1
    FROM dbo.inbound_calls WITH (UPDLOCK, HOLDLOCK)
    WHERE call_time = CONVERT(datetime2(0), @call_time, 120)
      AND called_no = @called_no
      AND (
        agent_id = @agent_id
        OR (agent_id IS NULL AND @agent_id IS NULL)
      )
  );
`;

const INSERT_INPUTS = [
  ["did_no", sql.NVarChar(100)],
  ["group_name", sql.NVarChar(255)],
  ["called_no", sql.NVarChar(50)],
  ["call_time", sql.NVarChar(19)],
  ["ring_duration", sql.NVarChar(8)],
  ["ivr_duration", sql.NVarChar(8)],
  ["queue_duration", sql.NVarChar(8)],
  ["agent_duration", sql.NVarChar(8)],
  ["hold_duration", sql.NVarChar(8)],
  ["total_duration", sql.NVarChar(8)],
  ["call_end", sql.NVarChar(100)],
  ["agent_id", sql.NVarChar(50)],
  ["call_type", sql.NVarChar(50)],
  ["acd", sql.NVarChar(50)],
  ["disposition", sql.NVarChar(255)],
  ["sub_disposition", sql.NVarChar(255)],
  ["shift", sql.NVarChar(20)],
  ["call_hour", sql.Int]
];

function cleanValue(value) {
  if (value === undefined || value === null) {
    return "";
  }
  return String(value).trim();
}

function normalizeRow(row) {
  const callTime = parseDateTime(row["Call Time"]);
  if (!callTime) {
    return { error: "Invalid Call Time" };
  }

  const values = [
    cleanValue(row["DID No"]),
    cleanValue(row["Group Name"]),
    cleanValue(row["Called No"]),
    callTime.sql,
    secondsToTime(durationToSeconds(row["Ring Duration"])),
    secondsToTime(durationToSeconds(row["IVR Duration"])),
    secondsToTime(durationToSeconds(row["Queue Duration"])),
    secondsToTime(durationToSeconds(row["Agent Duration"])),
    secondsToTime(durationToSeconds(row["Hold Duration"])),
    secondsToTime(durationToSeconds(row["Duration"])),
    cleanValue(row["Call End"]),
    cleanValue(row.Agent),
    cleanValue(row["Call Type"]),
    cleanValue(row.ACD),
    cleanValue(row.Disposition),
    cleanValue(row["Sub Disposition"]),
    calculateShift(callTime.hour, callTime.minutes),
    callTime.hour
  ];

  if (!values[2]) {
    return { error: "Missing Called No" };
  }

  return { values };
}

function isCdrHeaderRow(line = "") {
  const recognizedHeaders = ["DID No", "Group Name", "Called No", "Call Time"];
  const headers = line.split(",").map(cleanHeader);
  const recognizedCount = headers.filter((header) => recognizedHeaders.includes(header)).length;

  return recognizedCount >= 2;
}

function parseCsv(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    let missingColumns = null;
    const fileContent = fs.readFileSync(filePath, "utf8");
    const lines = fileContent.split(/\r?\n/);
    const headerRowIndex = [0, 1].find((index) => isCdrHeaderRow(lines[index]));
    const csvContent = lines.slice(headerRowIndex ?? 1).join("\n");

    Readable.from([csvContent])
      .pipe(
        csv({
          mapHeaders: ({ header }) => cleanHeader(header)
        })
      )
      .on("headers", (headers) => {
        console.log("CSV Headers:", headers);
        missingColumns = validateColumns(headers);
        console.log("Missing Columns:", missingColumns);
      })
      .on("data", (row) => rows.push(row))
      .on("error", reject)
      .on("end", () => {
        if (missingColumns?.length) {
          const error = new Error(
            `CSV is missing required columns: ${missingColumns.join(", ")}`
          );
          error.statusCode = 400;
          reject(error);
          return;
        }

        resolve(rows);
      });
  });
}

function bindInsertInputs(request, values) {
  INSERT_INPUTS.forEach(([name, type], index) => {
    request.input(name, type, values[index]);
  });
}

export async function importCsv(filePath) {
  const rows = await parseCsv(filePath);
  let insertedRows = 0;
  let skippedRows = 0;
  let failedRows = 0;

  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    for (const row of rows) {
      const normalized = normalizeRow(row);
      if (normalized.error) {
        failedRows += 1;
        continue;
      }

      try {
        const request = new sql.Request(transaction);
        bindInsertInputs(request, normalized.values);
        const result = await request.query(INSERT_SQL);

        if (result.rowsAffected[0] === 1) {
          insertedRows += 1;
        } else {
          skippedRows += 1;
        }
      } catch (error) {
        failedRows += 1;
      }
    }

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }

  return {
    success: true,
    totalRows: rows.length,
    insertedRows,
    skippedRows,
    failedRows
  };
}
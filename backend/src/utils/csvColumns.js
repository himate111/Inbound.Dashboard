export const HEADER_ALIASES = {
  "Ring Durn": "Ring Duration",
  "IVR Dur": "IVR Duration",
  "Queue Durn": "Queue Duration",
  "Agent Durn": "Agent Duration",
  "Hold Durn": "Hold Duration",
  "Durn": "Duration",
  "Call End At": "Call End",
  "Call Start Time": "Call Time",
  "Agent ID": "Agent"
};

export const REQUIRED_COLUMNS = [
  "DID No",
  "Group Name",
  "Called No",
  "Call Time",
  "Ring Duration",
  "IVR Duration",
  "Queue Duration",
  "Agent Duration",
  "Hold Duration",
  "Duration",
  "Call End",
  "Agent",
  "Call Type",
  "ACD",
  "Disposition",
  "Sub Disposition"
];

export function cleanHeader(header = "") {
  const value = String(header)
    .replace(/^\uFEFF/, "")
    .trim();

  return HEADER_ALIASES[value] || value;
}

export function validateColumns(headers = []) {
  const normalizedHeaders = headers.map(cleanHeader);

  return REQUIRED_COLUMNS.filter(
    (column) => !normalizedHeaders.includes(column)
  );
}

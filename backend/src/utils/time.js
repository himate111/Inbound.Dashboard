function pad(value) {
  return String(value).padStart(2, "0");
}

function isEmpty(value) {
  return value === undefined || value === null || String(value).trim() === "";
}

export function parseDateTime(value) {
  if (isEmpty(value)) {
    return null;
  }

  const raw = String(value).trim();
  const normalized = raw.replace("T", " ").replace(/\.\d+Z?$/, "").replace(/Z$/, "");

  const iso = normalized.match(
    /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/
  );
  if (iso) {
    const [, year, month, day, hour, minute, second = "00"] = iso;
    return buildDateTime({ year, month, day, hour, minute, second });
  }

  const dmy = normalized.match(
    /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/
  );
  if (dmy) {
    const [, first, secondPart, year, hour, minute, second = "00"] = dmy;
    const firstNumber = Number(first);
    const secondNumber = Number(secondPart);
    const day = firstNumber > 12 ? first : secondPart;
    const month = firstNumber > 12 ? secondPart : firstNumber <= 12 && secondNumber <= 12 ? first : first;
    return buildDateTime({ year, month, day, hour, minute, second });
  }




  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return {
    sql: `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())} ${pad(
      parsed.getHours()
    )}:${pad(parsed.getMinutes())}:${pad(parsed.getSeconds())}`,
    hour: parsed.getHours(),
    minutes: parsed.getMinutes()
  };
}

function buildDateTime({ year, month, day, hour, minute, second }) {
  const monthNumber = Number(month);
  const dayNumber = Number(day);
  const hourNumber = Number(hour);
  const minuteNumber = Number(minute);
  const secondNumber = Number(second);

  if (
    monthNumber < 1 ||
    monthNumber > 12 ||
    dayNumber < 1 ||
    dayNumber > 31 ||
    hourNumber < 0 ||
    hourNumber > 23 ||
    minuteNumber < 0 ||
    minuteNumber > 59 ||
    secondNumber < 0 ||
    secondNumber > 59
  ) {
    return null;
  }

  return {
    sql: `${year}-${pad(monthNumber)}-${pad(dayNumber)} ${pad(hourNumber)}:${pad(minuteNumber)}:${pad(
      secondNumber
    )}`,
    hour: hourNumber,
    minutes: minuteNumber
  };
}

export function durationToSeconds(value) {
  if (isEmpty(value)) {
    return 0;
  }

  const raw = String(value).trim();
  const numeric = Number(raw);
  if (!Number.isNaN(numeric) && raw !== "") {
    if (numeric > 0 && numeric < 1) {
      return Math.round(numeric * 86400);
    }
    return Math.max(0, Math.round(numeric));
  }

  const parts = raw.split(":").map((part) => Number(part));
  if (parts.some((part) => Number.isNaN(part))) {
    return 0;
  }

  if (parts.length === 3) {
    return Math.max(0, parts[0] * 3600 + parts[1] * 60 + parts[2]);
  }

  if (parts.length === 2) {
    return Math.max(0, parts[0] * 60 + parts[1]);
  }

  return 0;
}

export function secondsToTime(seconds = 0) {
  const safeSeconds = Math.max(0, Math.round(Number(seconds) || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const secs = safeSeconds % 60;
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
}

export function secondsToLabel(seconds = 0) {
  const safeSeconds = Math.max(0, Math.round(Number(seconds) || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const secs = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

export function calculateShift(hour, minutes = 0) {
  const totalMinutes = Number(hour) * 60 + Number(minutes);
  if (totalMinutes >= 7 * 60 && totalMinutes <= 14 * 60 + 59) {
    return "Shift 1";
  }
  if (totalMinutes >= 15 * 60 && totalMinutes <= 22 * 60 + 59) {
    return "Shift 2";
  }
  return "Shift 3";
}

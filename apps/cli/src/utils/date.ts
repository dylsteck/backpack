export function parseDate(input: string): Date {
  const trimmed = input.trim().toLowerCase();
  const now = new Date();

  const match = trimmed.match(/^(\d+)([dwm])$/);
  if (match) {
    const num = parseInt(match[1], 10);
    const unit = match[2];
    const result = new Date(now);
    if (unit === "d") {
      result.setDate(result.getDate() - num);
    } else if (unit === "w") {
      result.setDate(result.getDate() - num * 7);
    } else if (unit === "m") {
      result.setMonth(result.getMonth() - num);
    }
    return result;
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  throw new Error(`Invalid date: ${input}`);
}

export function getDatePartsInTimezone(
  timezone: string,
  date = new Date()
): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    const fallbackDate = new Date();

    return {
      year: fallbackDate.getUTCFullYear(),
      month: fallbackDate.getUTCMonth() + 1,
      day: fallbackDate.getUTCDate(),
    };
  }

  return { year, month, day };
}

export function getCurrentDateStringInTimezone(timezone: string): string {
  const { year, month, day } = getDatePartsInTimezone(timezone);

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function getTodayDateOnlyInTimezone(timezone: string): Date {
  const { year, month, day } = getDatePartsInTimezone(timezone);

  return new Date(Date.UTC(year, month - 1, day));
}

export function getCurrentDateRangeInTimezone(
  period: "day" | "week" | "month" | "year",
  timezone: string
): { startDate: Date; endDate: Date } {
  const { year, month, day } = getDatePartsInTimezone(timezone);

  if (period === "day") {
    return {
      startDate: new Date(Date.UTC(year, month - 1, day)),
      endDate: new Date(Date.UTC(year, month - 1, day + 1)),
    };
  }

  if (period === "week") {
    const currentDate = new Date(Date.UTC(year, month - 1, day));
    const dayOfWeek = currentDate.getUTCDay();
    const daysFromMonday = (dayOfWeek + 6) % 7;
    const startDate = new Date(Date.UTC(year, month - 1, day - daysFromMonday));

    return {
      startDate,
      endDate: new Date(Date.UTC(
        startDate.getUTCFullYear(),
        startDate.getUTCMonth(),
        startDate.getUTCDate() + 7
      )),
    };
  }

  if (period === "month") {
    return {
      startDate: new Date(Date.UTC(year, month - 1, 1)),
      endDate: new Date(Date.UTC(year, month, 1)),
    };
  }

  return {
    startDate: new Date(Date.UTC(year, 0, 1)),
    endDate: new Date(Date.UTC(year + 1, 0, 1)),
  };
}

const arabicDigitMap: Record<string, string> = {
  "٠": "0",
  "١": "1",
  "٢": "2",
  "٣": "3",
  "٤": "4",
  "٥": "5",
  "٦": "6",
  "٧": "7",
  "٨": "8",
  "٩": "9",
};

const arabicWordNumbers: Record<string, number> = {
  واحد: 1,
  يوم: 1,
  يومين: 2,
  اثنين: 2,
  اتنين: 2,
  ثلاث: 3,
  ثلاثة: 3,
  تلات: 3,
};

const russianWordNumbers: Record<string, number> = {
  один: 1,
  два: 2,
  три: 3,
};

const englishWordNumbers: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
};

const arabicWeekdays: Array<{ words: string[]; day: number }> = [
  { words: ["الأحد", "الاحد", "الحد"], day: 0 },
  { words: ["الاثنين", "الإثنين", "الاتنين"], day: 1 },
  { words: ["الثلاثاء", "التلات"], day: 2 },
  { words: ["الأربعاء", "الاربعاء", "الاربع"], day: 3 },
  { words: ["الخميس"], day: 4 },
  { words: ["الجمعة"], day: 5 },
  { words: ["السبت"], day: 6 },
];

const russianWeekdays: Array<{ pattern: RegExp; day: number }> = [
  { pattern: /(?:прошл(?:ый|ом)\s+)?понедельник/i, day: 1 },
  { pattern: /(?:прошл(?:ый|ом)\s+)?вторник/i, day: 2 },
  { pattern: /(?:прошл(?:ую|ой)\s+)?среду/i, day: 3 },
  { pattern: /(?:прошл(?:ый|ом)\s+)?четверг/i, day: 4 },
  { pattern: /(?:прошл(?:ую|ой)\s+)?пятницу/i, day: 5 },
  { pattern: /(?:прошл(?:ую|ой)\s+)?субботу/i, day: 6 },
  { pattern: /(?:прошл(?:ое|ом)\s+)?воскресенье/i, day: 0 },
];

const englishWeekdays: Array<{ word: string; day: number }> = [
  { word: "sunday", day: 0 },
  { word: "monday", day: 1 },
  { word: "tuesday", day: 2 },
  { word: "wednesday", day: 3 },
  { word: "thursday", day: 4 },
  { word: "friday", day: 5 },
  { word: "saturday", day: 6 },
];

export type RelativeDateMatch = {
  date: Date;
  matchedText: string;
};

function normalizeArabicDigits(text: string): string {
  return text.replace(/[٠-٩]/g, (digit) => arabicDigitMap[digit] ?? digit);
}

function dateAtUtcMidnight(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day));
}

function addUtcDays(date: Date, days: number): Date {
  return dateAtUtcMidnight(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() + days
  );
}

function toCalendarDate(currentDate: Date, _timezone: string): Date {
  return dateAtUtcMidnight(
    currentDate.getUTCFullYear(),
    currentDate.getUTCMonth(),
    currentDate.getUTCDate()
  );
}

function previousWeekday(currentDate: Date, targetDay: number): Date {
  const currentDay = currentDate.getUTCDay();
  const diff = (currentDay - targetDay + 7) % 7 || 7;

  return addUtcDays(currentDate, -diff);
}

function matchFixedPhrase(
  text: string,
  currentDate: Date,
  phrases: Array<{ pattern: RegExp; daysOffset: number }>
): RelativeDateMatch | null {
  for (const phrase of phrases) {
    const match = phrase.pattern.exec(text);

    if (match?.[0]) {
      return {
        date: addUtcDays(currentDate, phrase.daysOffset),
        matchedText: match[0],
      };
    }
  }

  return null;
}

function parseArabicDaysAgo(text: string, currentDate: Date): RelativeDateMatch | null {
  const normalizedText = normalizeArabicDigits(text);
  const match = /من\s+((?:\d+)|(?:يومين|يوم|واحد|اثنين|اتنين|ثلاث|ثلاثة|تلات))\s*(?:يوم|ايام|أيام)?/i.exec(
    normalizedText
  );

  if (!match?.[0] || !match[1]) {
    return null;
  }

  const days = /^\d+$/.test(match[1])
    ? Number(match[1])
    : arabicWordNumbers[match[1]];

  if (!days || days <= 0) {
    return null;
  }

  return {
    date: addUtcDays(currentDate, -days),
    matchedText: text.slice(match.index, match.index + match[0].length),
  };
}

function parseRussianDaysAgo(text: string, currentDate: Date): RelativeDateMatch | null {
  const match = /((?:\d+)|(?:два|три))\s+дн(?:я|ей)\s+назад/i.exec(text);

  if (!match?.[0] || !match[1]) {
    return null;
  }

  const days = /^\d+$/.test(match[1])
    ? Number(match[1])
    : russianWordNumbers[match[1].toLowerCase()];

  if (!days || days <= 0) {
    return null;
  }

  return {
    date: addUtcDays(currentDate, -days),
    matchedText: match[0],
  };
}

function parseEnglishDaysAgo(text: string, currentDate: Date): RelativeDateMatch | null {
  const match = /((?:\d+)|(?:one|two|three))\s+days?\s+ago/i.exec(text);

  if (!match?.[0] || !match[1]) {
    return null;
  }

  const days = /^\d+$/.test(match[1])
    ? Number(match[1])
    : englishWordNumbers[match[1].toLowerCase()];

  if (!days || days <= 0) {
    return null;
  }

  return {
    date: addUtcDays(currentDate, -days),
    matchedText: match[0],
  };
}

function parseArabicPreviousWeekday(text: string, currentDate: Date): RelativeDateMatch | null {
  const hasLastMarker = /(?:فات|الماضي|الماضية)/.test(text);

  if (!hasLastMarker) {
    return null;
  }

  for (const weekday of arabicWeekdays) {
    for (const word of weekday.words) {
      const index = text.indexOf(word);

      if (index !== -1) {
        const phraseMatch = new RegExp(
          `(?:يوم\\s+)?${word}(?:\\s+\\S+){0,3}?\\s*(?:فات\\S*|الماضي\\S*)?`
        ).exec(text.slice(Math.max(0, index - 4)));

        return {
          date: previousWeekday(currentDate, weekday.day),
          matchedText: phraseMatch?.[0]?.trim() || word,
        };
      }
    }
  }

  return null;
}

function parseRussianPreviousWeekday(text: string, currentDate: Date): RelativeDateMatch | null {
  if (!/прошл/i.test(text)) {
    return null;
  }

  for (const weekday of russianWeekdays) {
    const match = new RegExp(`(?:в\\s+)?${weekday.pattern.source}`, "i").exec(text);

    if (match?.[0]) {
      return {
        date: previousWeekday(currentDate, weekday.day),
        matchedText: match[0],
      };
    }
  }

  return null;
}

function parseEnglishPreviousWeekday(text: string, currentDate: Date): RelativeDateMatch | null {
  for (const weekday of englishWeekdays) {
    const match = new RegExp(`last\\s+${weekday.word}`, "i").exec(text);

    if (match?.[0]) {
      return {
        date: previousWeekday(currentDate, weekday.day),
        matchedText: match[0],
      };
    }
  }

  return null;
}

export function extractRelativeDateFromText(
  text: string,
  currentDate: Date,
  timezone: string
): RelativeDateMatch | null {
  const calendarDate = toCalendarDate(currentDate, timezone);

  return (
    matchFixedPhrase(text, calendarDate, [
      { pattern: /(?:أول|اول)\s+(?:أمس|امس|امبارح)/i, daysOffset: -2 },
      { pattern: /day before yesterday/i, daysOffset: -2 },
      { pattern: /позавчера/i, daysOffset: -2 },
      { pattern: /(?:اليوم|النهارده|انهارده)/i, daysOffset: 0 },
      { pattern: /today/i, daysOffset: 0 },
      { pattern: /сегодня/i, daysOffset: 0 },
      { pattern: /(?:أمس|امس|مبارح|امبارح|البارح)/i, daysOffset: -1 },
      { pattern: /yesterday/i, daysOffset: -1 },
      { pattern: /вчера/i, daysOffset: -1 },
    ]) ??
    parseArabicDaysAgo(text, calendarDate) ??
    parseRussianDaysAgo(text, calendarDate) ??
    parseEnglishDaysAgo(text, calendarDate) ??
    parseArabicPreviousWeekday(text, calendarDate) ??
    parseRussianPreviousWeekday(text, calendarDate) ??
    parseEnglishPreviousWeekday(text, calendarDate)
  );
}

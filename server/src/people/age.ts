export interface AgeResult {
  birthYear: number | null;
  deceased: boolean;
  age: number | null;
}

export interface CalendarDay {
  year: number;
  month: number;
  day: number;
}

const YEAR_RE = /(?<!\d)(18\d{2}|19\d{2}|20\d{2})(?!\d)/;
const LUNAR_RE = /正月|腊月|冬月|闰月|初|廿|卅|[子丑寅卯辰巳午未申酉戌亥]时/;

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function readYear(text: string | null | undefined): number | null {
  if (!text) return null;
  const match = text.match(YEAR_RE);
  if (!match) return null;
  const year = Number(match[1]);
  if (year < 1800 || year > 2099) return null;
  return year;
}

function readMonthDay(text: string, year: number): { month: number; day: number } | null {
  if (LUNAR_RE.test(text)) return null;
  const patterns = [
    new RegExp(String.raw`${year}\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日`),
    new RegExp(String.raw`${year}\s*[./-]\s*(\d{1,2})\s*[./-]\s*(\d{1,2})(?!\d)`),
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const month = Number(match[1]);
    const day = Number(match[2]);
    if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
    return { month, day };
  }
  return null;
}

function before(month: number, day: number, otherMonth: number, otherDay: number): boolean {
  return month < otherMonth || (month === otherMonth && day < otherDay);
}

export function deriveAge(
  birthText: string | null | undefined,
  deathText: string | null | undefined,
  today: CalendarDay,
): AgeResult {
  const birth = birthText ?? '';
  const death = deathText ?? '';
  const deceased = death.trim().length > 0;
  const birthYear = readYear(birth);
  const deathYear = readYear(death);
  if (birthYear == null) {
    return { birthYear: null, deceased, age: null };
  }
  if (deceased && deathYear == null) {
    return { birthYear, deceased, age: null };
  }
  const endYear = deceased ? deathYear! : today.year;
  const birthMd = readMonthDay(birth, birthYear);
  const endMd = deceased
    ? readMonthDay(death, deathYear!)
    : { month: today.month, day: today.day };
  let age = endYear - birthYear;
  if (birthMd && endMd && before(endMd.month, endMd.day, birthMd.month, birthMd.day)) {
    age -= 1;
  }
  return { birthYear, deceased, age: age < 0 ? null : age };
}

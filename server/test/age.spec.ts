import { deriveAge } from '../src/people/age';

const today = { year: 2026, month: 11, day: 25 };

describe('deriveAge', () => {
  const cases: Array<[string | null, string | null, number | null, number | null, boolean]> = [
    ['1900.2.18', '1963.4.7', 63, 1900, true],
    ['1945 年', null, 81, 1945, false],
    ['1868年8月12日', '1951年3月29日', 82, 1868, true],
    ['正月十九', null, null, null, false],
    ['十一月初八', '四月十二', null, null, true],
    ['1958.4.7', null, 68, 1958, false],
    ['2020.12.1', '2020.1.1', null, 2020, true],
  ];

  it.each(cases)('%s / %s', (birth, death, age, birthYear, deceased) => {
    expect(deriveAge(birth, death, today)).toEqual({ age, birthYear, deceased });
  });
});

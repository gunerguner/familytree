import { layout } from '../src/lib/layout';
import { rootIds } from '../src/lib/graph';
import type { Marriage, ParentLink, Person } from '../src/api/types';

function person(id: number, name: string): Person {
  return {
    id,
    name,
    sex: 'male',
    kinship: null,
    formerName: null,
    nickname: null,
    birthText: null,
    deathText: null,
    narrative: null,
    birthYear: null,
    deceased: false,
    age: null,
  };
}

const emptyParents: ParentLink[] = [];
const emptyMarriages: Marriage[] = [];

describe('layout', () => {
  it('keeps a childless spouse beside the person who has the descendants', () => {
    const persons = [
      person(1, '张尔寿'),
      { ...person(2, '范氏'), deceased: true, birthYear: 1920, age: 80 },
      person(3, '张伯森'),
    ];
    const parents: ParentLink[] = [
      { childId: 3, parentId: 1, role: 'father', sortOrder: 0 },
      { childId: 3, parentId: 2, role: 'mother', sortOrder: 0 },
    ];
    const marriages: Marriage[] = [{ id: 1, aId: 1, bId: 2, label: '妻子', sortOrder: 0 }];
    expect(rootIds(persons, parents, marriages)).toEqual([1]);
    const result = layout(persons, parents, marriages, new Set());
    expect(result.cards.filter((card) => !card.side).map((card) => card.id)).toEqual([1, 3]);
    expect(result.cards.find((card) => card.id === 2)?.side).toBe(true);
    expect(new Set(result.cards.map((card) => card.width))).toEqual(new Set([112]));
    expect(new Set(result.cards.map((card) => card.height))).toEqual(new Set([48]));
    expect(result.lines.some((line) => line.kind === 'marriage')).toBe(true);
    expect(result.lines.some((line) => line.kind === 'blood')).toBe(true);
    const couple = result.lines.find((line) => line.kind === 'marriage')!;
    expect(couple.d).toContain('H');
    expect(couple.source).toBe('1');
    expect(couple.target).toBe('2');
    const blood = result.lines.find((line) => line.kind === 'blood')!;
    expect(blood.source).toBe('2');
    expect(blood.target).toBe('fold:1');
  });

  it('keeps the second wife of a side spouse beside him', () => {
    const persons = [
      person(0, '张柏森'),
      person(1, '大姑母'),
      person(2, '邵季珊'),
      person(3, '邱氏'),
      person(4, '榴官'),
      person(5, '达元'),
    ];
    const parents: ParentLink[] = [
      { childId: 1, parentId: 0, role: 'father', sortOrder: 0 },
      { childId: 4, parentId: 1, role: 'mother', sortOrder: 0 },
      { childId: 4, parentId: 2, role: 'father', sortOrder: 0 },
      { childId: 5, parentId: 2, role: 'father', sortOrder: 2 },
      { childId: 5, parentId: 3, role: 'mother', sortOrder: 0 },
    ];
    const marriages: Marriage[] = [
      { id: 1, aId: 2, bId: 1, label: '妻子', sortOrder: 0 },
      { id: 2, aId: 2, bId: 3, label: '续弦', sortOrder: 1 },
    ];
    const result = layout(persons, parents, marriages, new Set());
    expect(result.cards.map((card) => card.id)).toEqual(expect.arrayContaining([1, 2, 3, 4, 5]));
    expect(result.cards.filter((card) => card.side).map((card) => card.id)).toEqual([2, 3]);
    expect(
      result.lines
        .filter((line) => line.kind === 'marriage')
        .map((line) => [line.source, line.target]),
    ).toEqual([
      ['1', '2'],
      ['2', '3'],
    ]);
  });

  it('places disconnected people on one row', () => {
    const persons = [person(1, '甲'), person(2, '乙')];
    const result = layout(persons, emptyParents, emptyMarriages, new Set());
    expect(result.roots).toEqual([1, 2]);
    const first = result.cards.find((card) => card.id === 1)!;
    const second = result.cards.find((card) => card.id === 2)!;
    expect(first.y).toBe(second.y);
    expect(second.x).toBeGreaterThan(first.x);
  });

  it('hides only the folded branch', () => {
    const persons = [person(1, '根甲'), person(2, '子'), person(3, '根乙')];
    const parents: ParentLink[] = [{ childId: 2, parentId: 1, role: 'father', sortOrder: 0 }];
    const result = layout(persons, parents, emptyMarriages, new Set([1]));
    expect(result.cards.some((card) => card.id === 2)).toBe(false);
    expect(result.cards.some((card) => card.id === 3)).toBe(true);
    expect(result.cards.some((card) => card.id === 1)).toBe(true);
    expect(result.folds).toEqual([expect.objectContaining({ id: 1, collapsed: true })]);
    expect(result.lines.find((line) => line.kind === 'blood')).toMatchObject({ source: '1', target: 'fold:1' });
  });

  it('turns a child into a root after the parent link is gone', () => {
    const persons = [person(1, '父'), person(2, '子')];
    expect(rootIds(persons, emptyParents, emptyMarriages)).toEqual([1, 2]);
  });
});

import { layout, rootIds } from '../src/lib/layout';
import type { Marriage, ParentLink, Person } from '../src/api/types';

function person(id: number, name: string): Person {
  return {
    id,
    name,
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
    const persons = [person(1, '张尔寿'), person(2, '范氏'), person(3, '张伯森')];
    const parents: ParentLink[] = [
      { childId: 3, parentId: 1, role: 'father', sortOrder: 0 },
      { childId: 3, parentId: 2, role: 'mother', sortOrder: 0 },
    ];
    const marriages: Marriage[] = [{ id: 1, aId: 1, bId: 2, label: '妻子', sortOrder: 0 }];
    expect(rootIds(persons, parents, marriages)).toEqual([1]);
    const result = layout(persons, parents, marriages, new Set());
    expect(result.cards.filter((card) => !card.side).map((card) => card.id)).toEqual([1, 3]);
    expect(result.cards.find((card) => card.id === 2)?.side).toBe(true);
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
  });

  it('turns a child into a root after the parent link is gone', () => {
    const persons = [person(1, '父'), person(2, '子')];
    expect(rootIds(persons, emptyParents, emptyMarriages)).toEqual([1, 2]);
  });
});

import { toFlow } from '../src/lib/flow';
import { foldNodeId, layout } from '../src/lib/layout';
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

describe('toFlow', () => {
  it('maps cards, folds, and paths onto nodes and edges', () => {
    const persons = [person(1, '张尔寿'), person(2, '范氏'), person(3, '张伯森')];
    const parents: ParentLink[] = [
      { childId: 3, parentId: 1, role: 'father', sortOrder: 0 },
      { childId: 3, parentId: 2, role: 'mother', sortOrder: 0 },
    ];
    const marriages: Marriage[] = [{ id: 1, aId: 1, bId: 2, label: '妻子', sortOrder: 0 }];
    const result = layout(persons, parents, marriages, new Set());
    const flow = toFlow(result, persons, 3);

    const people = flow.nodes.filter((node) => node.type === 'person');
    expect(people.map((node) => node.id)).toEqual(result.cards.map((card) => String(card.id)));
    const child = people.find((node) => node.id === '3');
    const root = result.cards.find((card) => card.id === 1)!;
    expect(child?.data.selected).toBe(true);
    expect(people.find((node) => node.id === '1')?.data.selected).toBe(false);
    expect(people.find((node) => node.id === '1')?.position).toEqual({ x: root.x, y: root.y });

    const fold = result.folds[0];
    expect(flow.nodes.find((node) => node.type === 'fold')).toMatchObject({
      id: foldNodeId(fold.id),
      position: { x: fold.x, y: fold.y },
      data: { personId: fold.id, collapsed: fold.collapsed },
    });

    expect(flow.edges.map((edge) => edge.data?.d)).toEqual(result.lines.map((line) => line.d));
    expect(flow.edges.find((edge) => edge.data?.kind === 'marriage')).toMatchObject({ source: '1', target: '2' });
    expect(flow.edges.find((edge) => edge.data?.kind === 'blood')).toMatchObject({ source: '2', target: foldNodeId(1) });
  });
});
import type { Marriage, ParentLink, Person } from '../api/types';

export interface LayoutCard {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  side: boolean;
  hasChildren: boolean;
  collapsed: boolean;
}

interface Line {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  x3: number;
  y3: number;
  x4: number;
  y4: number;
}

export interface LayoutResult {
  width: number;
  height: number;
  roots: number[];
  cards: LayoutCard[];
  lines: string[];
}

const MARGIN = 48;
const ROOT_GAP = 80;
const CARD_GAP = 12;
const GROUP_GAP = 28;
const GENERATION_GAP = 56;

function spousesOf(id: number, marriages: Marriage[]) {
  return marriages
    .filter((item) => item.aId === id || item.bId === id)
    .map((item) => ({ id: item.aId === id ? item.bId : item.aId, sortOrder: item.sortOrder }))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
}

function childLinks(id: number, parents: ParentLink[]) {
  return parents
    .filter((link) => link.parentId === id)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.childId - b.childId);
}

function descendantCount(id: number, parents: ParentLink[]) {
  const seen = new Set<number>();
  const stack = childLinks(id, parents).map((link) => link.childId);
  while (stack.length) {
    const current = stack.pop()!;
    if (seen.has(current)) continue;
    seen.add(current);
    for (const link of childLinks(current, parents)) stack.push(link.childId);
  }
  return seen.size;
}

function preferRoot(a: number, b: number, counts: Map<number, number>) {
  const da = counts.get(a) ?? 0;
  const db = counts.get(b) ?? 0;
  if (da !== db) return da > db ? a : b;
  return Math.min(a, b);
}

export function rootIds(persons: Person[], parents: ParentLink[], marriages: Marriage[]) {
  const hasParent = new Set(parents.map((link) => link.childId));
  const counts = new Map(persons.map((person) => [person.id, descendantCount(person.id, parents)]));
  const roots: number[] = [];
  for (const person of persons) {
    if (hasParent.has(person.id)) continue;
    const side = spousesOf(person.id, marriages).some((spouse) => {
      if (hasParent.has(spouse.id)) return true;
      return preferRoot(person.id, spouse.id, counts) !== person.id;
    });
    if (!side) roots.push(person.id);
  }
  return roots.sort((a, b) => a - b);
}

export function secondLine(person: Person) {
  const parts: string[] = [];
  if (person.birthYear != null) parts.push(String(person.birthYear));
  if (person.deceased) parts.push('已卒');
  if (person.age != null) parts.push(`${person.age}岁`);
  return parts.join(' ');
}

function cardSize(person: Person, side: boolean) {
  const text = [...person.name].length * 16 + 32;
  return {
    width: side ? Math.max(80, text) : Math.min(168, Math.max(96, text)),
    height: secondLine(person) ? 64 : 44,
  };
}

interface Unit {
  width: number;
  height: number;
  topX: number;
  cards: LayoutCard[];
  lines: Line[];
}

function moveLine(line: Line, dx: number, dy: number): Line {
  return {
    x1: line.x1 + dx,
    y1: line.y1 + dy,
    x2: line.x2 + dx,
    y2: line.y2 + dy,
    x3: line.x3 + dx,
    y3: line.y3 + dy,
    x4: line.x4 + dx,
    y4: line.y4 + dy,
  };
}

export function layout(
  persons: Person[],
  parents: ParentLink[],
  marriages: Marriage[],
  collapsed: Set<number>,
): LayoutResult {
  const byId = new Map(persons.map((person) => [person.id, person]));
  const roots = rootIds(persons, parents, marriages);
  const structural = new Set<number>();
  const pending = [...roots];
  while (pending.length) {
    const id = pending.pop()!;
    if (structural.has(id)) continue;
    structural.add(id);
    for (const link of childLinks(id, parents)) pending.push(link.childId);
  }

  function layoutUnit(id: number): Unit {
    const person = byId.get(id)!;
    const main = cardSize(person, false);
    const row = [{ id, side: false, ...main }];
    for (const spouse of spousesOf(id, marriages)) {
      if (structural.has(spouse.id)) continue;
      const spousePerson = byId.get(spouse.id);
      if (!spousePerson) continue;
      row.push({ id: spouse.id, side: true, ...cardSize(spousePerson, true) });
    }
    const rowWidth = row.reduce((sum, card) => sum + card.width, 0) + CARD_GAP * (row.length - 1);
    const rowHeight = Math.max(...row.map((card) => card.height));
    const spouseOrder = spousesOf(id, marriages).map((spouse) => spouse.id);
    const groups = new Map<number, number[]>();
    const seenChild = new Set<number>();
    const addChild = (childId: number, key: number) => {
      if (childId === id || seenChild.has(childId)) return;
      seenChild.add(childId);
      const list = groups.get(key) ?? [];
      list.push(childId);
      groups.set(key, list);
    };
    for (const link of childLinks(id, parents)) {
      const others = parents
        .filter((item) => item.childId === link.childId && item.parentId !== id)
        .map((item) => item.parentId)
        .sort((a, b) => {
          const ia = spouseOrder.indexOf(a);
          const ib = spouseOrder.indexOf(b);
          return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib) || a - b;
        });
      addChild(link.childId, others[0] ?? 0);
    }
    for (const spouse of row) {
      if (!spouse.side) continue;
      for (const link of childLinks(spouse.id, parents)) addChild(link.childId, spouse.id);
    }
    const hasChildren = seenChild.size > 0;
    const folded = collapsed.has(id);

    const placeRow = (shift: number): LayoutCard[] => {
      let x = shift;
      return row.map((card) => {
        const placed: LayoutCard = {
          id: card.id,
          x,
          y: 0,
          width: card.width,
          height: card.height,
          side: card.side,
          hasChildren: card.id === id && hasChildren,
          collapsed: card.id === id && folded,
        };
        x += card.width + CARD_GAP;
        return placed;
      });
    };

    const rowBox = rowHeight + (hasChildren ? 22 : 0);
    if (!hasChildren || folded) {
      return { width: rowWidth, height: rowBox, topX: main.width / 2, cards: placeRow(0), lines: [] };
    }

    const keys = [...groups.keys()].sort((a, b) => {
      if (a === 0) return 1;
      if (b === 0) return -1;
      const ia = spouseOrder.indexOf(a);
      const ib = spouseOrder.indexOf(b);
      return (ia < 0 ? 998 : ia) - (ib < 0 ? 998 : ib) || a - b;
    });
    const units = new Map<number, Unit>();
    for (const childId of [...groups.values()].flat()) units.set(childId, layoutUnit(childId));
    const groupWidths = keys.map((key) => {
      const list = groups.get(key)!;
      return list.reduce((sum, childId) => sum + units.get(childId)!.width, 0) + CARD_GAP * (list.length - 1);
    });
    const childrenWidth =
      groupWidths.reduce((sum, width) => sum + width, 0) + GROUP_GAP * Math.max(0, keys.length - 1);
    const width = Math.max(rowWidth, childrenWidth);
    const cards = placeRow((width - rowWidth) / 2);
    const lines: Line[] = [];
    let cursor = (width - childrenWidth) / 2;
    const childY = rowBox + GENERATION_GAP;
    let childrenHeight = 0;
    const mainCard = cards[0];

    keys.forEach((key, index) => {
      const list = groups.get(key)!;
      const sideCard = key ? cards.find((card) => card.side && card.id === key) : undefined;
      const anchorX = sideCard ? sideCard.x - CARD_GAP / 2 : mainCard.x + mainCard.width / 2;
      const anchorY = sideCard ? sideCard.y + sideCard.height : mainCard.y + mainCard.height;
      for (const childId of list) {
        const unit = units.get(childId)!;
        for (const card of unit.cards) {
          cards.push({ ...card, x: card.x + cursor, y: card.y + childY });
        }
        for (const line of unit.lines) lines.push(moveLine(line, cursor, childY));
        const targetX = cursor + unit.topX;
        const midY = anchorY + GENERATION_GAP / 2;
        lines.push({ x1: anchorX, y1: anchorY, x2: anchorX, y2: midY, x3: targetX, y3: midY, x4: targetX, y4: childY });
        childrenHeight = Math.max(childrenHeight, unit.height);
        cursor += unit.width + CARD_GAP;
      }
      cursor += GROUP_GAP - CARD_GAP;
      if (index === keys.length - 1) cursor -= GROUP_GAP - CARD_GAP;
    });

    return {
      width,
      height: childY + childrenHeight,
      topX: mainCard.x + mainCard.width / 2,
      cards,
      lines,
    };
  }

  const cards: LayoutCard[] = [];
  const lines: Line[] = [];
  let x = MARGIN;
  let treeHeight = 0;
  for (const root of roots) {
    const unit = layoutUnit(root);
    for (const card of unit.cards) cards.push({ ...card, x: card.x + x, y: card.y + MARGIN });
    for (const line of unit.lines) lines.push(moveLine(line, x, MARGIN));
    treeHeight = Math.max(treeHeight, unit.height);
    x += unit.width + ROOT_GAP;
  }
  return {
    width: roots.length ? x - ROOT_GAP + MARGIN : MARGIN * 2,
    height: treeHeight + MARGIN * 2,
    roots,
    cards,
    lines: lines.map((line) => `M ${line.x1} ${line.y1} V ${line.y2} H ${line.x3} V ${line.y4}`),
  };
}

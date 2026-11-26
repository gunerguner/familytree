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

export interface LayoutLine {
  d: string;
  kind: 'blood' | 'marriage';
  source: string;
  target: string;
}

export function foldNodeId(id: number) {
  return `fold:${id}`;
}

export interface LayoutFold {
  id: number;
  x: number;
  y: number;
  collapsed: boolean;
}

export interface LayoutResult {
  width: number;
  height: number;
  roots: number[];
  cards: LayoutCard[];
  lines: LayoutLine[];
  folds: LayoutFold[];
}

interface DraftLine {
  kind: 'blood' | 'marriage';
  source: string;
  target: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  railY?: number;
  childY?: number;
  targets?: number[];
}

interface Unit {
  width: number;
  height: number;
  topX: number;
  cards: LayoutCard[];
  lines: DraftLine[];
  folds: LayoutFold[];
}

const MARGIN = 48;
const ROOT_GAP = 80;
const CARD_W = 112;
const CARD_H = 48;
const SPOUSE_GAP = 36;
const CARD_GAP = 12;
const GROUP_GAP = 28;
const GENERATION_GAP = 56;
const FOLD_STUB = 22;

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

function moveLine(line: DraftLine, dx: number, dy: number): DraftLine {
  return {
    ...line,
    x1: line.x1 + dx,
    y1: line.y1 + dy,
    x2: line.x2 + dx,
    y2: line.y2 + dy,
    railY: line.railY == null ? undefined : line.railY + dy,
    childY: line.childY == null ? undefined : line.childY + dy,
    targets: line.targets?.map((x) => x + dx),
  };
}

function moveFold(fold: LayoutFold, dx: number, dy: number): LayoutFold {
  return { ...fold, x: fold.x + dx, y: fold.y + dy };
}

function marriageLines(cards: LayoutCard[]): DraftLine[] {
  const lines: DraftLine[] = [];
  for (let index = 0; index < cards.length - 1; index += 1) {
    const left = cards[index];
    const right = cards[index + 1];
    const y = left.y + left.height / 2;
    lines.push({
      kind: 'marriage',
      source: String(left.id),
      target: String(right.id),
      x1: left.x + left.width,
      y1: y,
      x2: right.x,
      y2: y,
    });
  }
  return lines;
}

function anchorOf(cards: LayoutCard[], key: number) {
  const main = cards[0];
  const side = key ? cards.find((card) => card.side && card.id === key) : undefined;
  if (!side) return { x: main.x + main.width / 2, y: main.y + main.height };
  return { x: side.x - SPOUSE_GAP / 2, y: side.y + side.height / 2 };
}

function anchorSource(cards: LayoutCard[], key: number, mainId: number) {
  if (key) {
    const side = cards.find((card) => card.side && card.id === key);
    if (side) return String(side.id);
  }
  return String(mainId);
}

function bloodLine(
  anchorX: number,
  anchorY: number,
  railY: number,
  childY: number,
  targets: number[],
  source: string,
  target: string,
): DraftLine {
  return { kind: 'blood', source, target, x1: anchorX, y1: anchorY, x2: anchorX, y2: railY, railY, childY, targets };
}

function toPath(line: DraftLine): LayoutLine {
  if (line.kind === 'marriage') {
    const top = line.y1 - 1.5;
    const bottom = line.y1 + 1.5;
    return {
      kind: 'marriage',
      source: line.source,
      target: line.target,
      d: `M ${line.x1} ${top} H ${line.x2} M ${line.x1} ${bottom} H ${line.x2}`,
    };
  }
  const targets = line.targets ?? [];
  const railY = line.railY ?? line.y2;
  const childY = line.childY ?? line.y2;
  const minX = Math.min(line.x1, ...targets);
  const maxX = Math.max(line.x1, ...targets);
  let d = `M ${line.x1} ${line.y1} V ${railY}`;
  if (maxX !== minX) d += ` M ${minX} ${railY} H ${maxX}`;
  for (const x of targets) {
    if (childY !== railY) d += ` M ${x} ${railY} V ${childY}`;
  }
  return { kind: 'blood', source: line.source, target: line.target, d };
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
    const row = [{ id, side: false, width: CARD_W, height: CARD_H }];
    for (const spouse of spousesOf(id, marriages)) {
      if (structural.has(spouse.id) || !byId.has(spouse.id)) continue;
      row.push({ id: spouse.id, side: true, width: CARD_W, height: CARD_H });
    }
    const rowWidth = row.reduce((sum, card) => sum + card.width, 0) + SPOUSE_GAP * Math.max(0, row.length - 1);
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
    const keys = [...groups.keys()].sort((a, b) => {
      if (a === 0) return 1;
      if (b === 0) return -1;
      const ia = spouseOrder.indexOf(a);
      const ib = spouseOrder.indexOf(b);
      return (ia < 0 ? 998 : ia) - (ib < 0 ? 998 : ib) || a - b;
    });

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
        x += card.width + SPOUSE_GAP;
        return placed;
      });
    };

    if (!hasChildren || folded) {
      const cards = placeRow(0);
      const lines = marriageLines(cards);
      const folds: LayoutFold[] = [];
      let height = CARD_H;
      if (hasChildren && folded) {
        const anchor = anchorOf(cards, keys[0] ?? 0);
        const stemTop = Math.max(anchor.y, CARD_H);
        const railY = stemTop + FOLD_STUB;
        lines.push(
          bloodLine(
            anchor.x,
            anchor.y,
            railY,
            railY,
            [anchor.x],
            anchorSource(cards, keys[0] ?? 0, id),
            foldNodeId(id),
          ),
        );
        folds.push({ id, x: anchor.x, y: (stemTop + railY) / 2, collapsed: true });
        height = railY;
      }
      return { width: rowWidth, height, topX: CARD_W / 2, cards, lines, folds };
    }

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
    const lines = marriageLines(cards);
    const folds: LayoutFold[] = [];
    let cursor = (width - childrenWidth) / 2;
    const childY = CARD_H + GENERATION_GAP;
    const railY = CARD_H + GENERATION_GAP / 2;
    let childrenHeight = 0;

    keys.forEach((key, index) => {
      const list = groups.get(key)!;
      const anchor = anchorOf(cards, key);
      const targets: number[] = [];
      for (const childId of list) {
        const unit = units.get(childId)!;
        for (const card of unit.cards) cards.push({ ...card, x: card.x + cursor, y: card.y + childY });
        for (const line of unit.lines) lines.push(moveLine(line, cursor, childY));
        for (const fold of unit.folds) folds.push(moveFold(fold, cursor, childY));
        targets.push(cursor + unit.topX);
        childrenHeight = Math.max(childrenHeight, unit.height);
        cursor += unit.width + CARD_GAP;
      }
      if (!folds.some((fold) => fold.id === id)) {
        const stemTop = Math.max(anchor.y, CARD_H);
        folds.push({ id, x: anchor.x, y: (stemTop + railY) / 2, collapsed: false });
      }
      lines.push(
        bloodLine(anchor.x, anchor.y, railY, childY, targets, anchorSource(cards, key, id), foldNodeId(id)),
      );
      cursor += GROUP_GAP - CARD_GAP;
      if (index === keys.length - 1) cursor -= GROUP_GAP - CARD_GAP;
    });

    return {
      width,
      height: childY + childrenHeight,
      topX: cards[0].x + CARD_W / 2,
      cards,
      lines,
      folds,
    };
  }

  const cards: LayoutCard[] = [];
  const lines: DraftLine[] = [];
  const folds: LayoutFold[] = [];
  let x = MARGIN;
  let treeHeight = 0;
  for (const root of roots) {
    const unit = layoutUnit(root);
    for (const card of unit.cards) cards.push({ ...card, x: card.x + x, y: card.y + MARGIN });
    for (const line of unit.lines) lines.push(moveLine(line, x, MARGIN));
    for (const fold of unit.folds) folds.push(moveFold(fold, x, MARGIN));
    treeHeight = Math.max(treeHeight, unit.height);
    x += unit.width + ROOT_GAP;
  }
  return {
    width: roots.length ? x - ROOT_GAP + MARGIN : MARGIN * 2,
    height: treeHeight + MARGIN * 2,
    roots,
    cards,
    lines: lines.map(toPath),
    folds,
  };
}

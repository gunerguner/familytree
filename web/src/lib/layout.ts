import type { Marriage, ParentLink, Person } from '../api/types';
import { childLinks, rootIds, spousesOf } from './graph';
import {
  bloodLine,
  marriageLines,
  moveFold,
  moveLine,
  toPath,
  type DraftLine,
} from './lines';

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

interface RowCard {
  id: number;
  side: boolean;
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

export function layout(
  persons: Person[],
  parents: ParentLink[],
  marriages: Marriage[],
  collapsed: Set<number>,
): LayoutResult {
  const byId = new Map(persons.map((person) => [person.id, person]));
  const roots = rootIds(persons, parents, marriages);
  const rootSet = new Set(roots);
  const structural = new Set<number>();
  const pending = [...roots];
  while (pending.length) {
    const id = pending.pop()!;
    if (structural.has(id)) continue;
    structural.add(id);
    for (const link of childLinks(id, parents)) pending.push(link.childId);
  }

  // 主卡与侧卡（含侧卡自己另配的人，如续弦）排成一行；已是根或在结构分支里的人有自己的位置，不重复
  const collectRow = (id: number): RowCard[] => {
    const row: RowCard[] = [{ id, side: false }];
    const placed = new Set([id]);
    for (const spouse of spousesOf(id, marriages)) {
      if (structural.has(spouse.id) || rootSet.has(spouse.id) || !byId.has(spouse.id)) continue;
      placed.add(spouse.id);
      row.push({ id: spouse.id, side: true });
    }
    for (let index = 1; index < row.length; index += 1) {
      for (const co of spousesOf(row[index].id, marriages)) {
        if (placed.has(co.id) || structural.has(co.id) || rootSet.has(co.id) || !byId.has(co.id)) continue;
        placed.add(co.id);
        row.push({ id: co.id, side: true });
      }
    }
    return row;
  };

  const groupChildren = (id: number, row: RowCard[]) => {
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
    const keys = [...groups.keys()].sort((a, b) => {
      if (a === 0) return 1;
      if (b === 0) return -1;
      const ia = spouseOrder.indexOf(a);
      const ib = spouseOrder.indexOf(b);
      return (ia < 0 ? 998 : ia) - (ib < 0 ? 998 : ib) || a - b;
    });
    return { groups, keys };
  };

  function layoutUnit(id: number): Unit {
    const row = collectRow(id);
    const { groups, keys } = groupChildren(id, row);
    const hasChildren = [...groups.values()].some((list) => list.length > 0);
    const folded = collapsed.has(id);
    const rowWidth = row.length * CARD_W + SPOUSE_GAP * (row.length - 1);

    const placeRow = (shift: number): LayoutCard[] => {
      let x = shift;
      return row.map((card) => {
        const placed: LayoutCard = {
          id: card.id,
          x,
          y: 0,
          width: CARD_W,
          height: CARD_H,
          side: card.side,
          hasChildren: card.id === id && hasChildren,
          collapsed: card.id === id && folded,
        };
        x += CARD_W + SPOUSE_GAP;
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

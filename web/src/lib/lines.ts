import type { LayoutCard, LayoutFold, LayoutLine } from './layout';

export interface DraftLine {
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

export function moveLine(line: DraftLine, dx: number, dy: number): DraftLine {
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

export function moveFold(fold: LayoutFold, dx: number, dy: number): LayoutFold {
  return { ...fold, x: fold.x + dx, y: fold.y + dy };
}

export function marriageLines(cards: LayoutCard[]): DraftLine[] {
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

export function bloodLine(
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

export function toPath(line: DraftLine): LayoutLine {
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

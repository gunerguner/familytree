import type { Edge, Node } from '@xyflow/vue';
import type { Person } from '../api/types';
import { foldNodeId, type LayoutResult } from './layout';
import { COLORS } from './tokens';

export interface PersonNodeData extends Record<string, unknown> {
  person: Person;
  selected: boolean;
}

export interface FoldNodeData extends Record<string, unknown> {
  personId: number;
  collapsed: boolean;
}

export interface FamilyEdgeData extends Record<string, unknown> {
  d: string;
  kind: 'blood' | 'marriage';
}

export type PersonNode = Node<PersonNodeData, 'person'>;
export type FoldNode = Node<FoldNodeData, 'fold'>;
export type FlowNode = PersonNode | FoldNode;
export type FamilyEdge = Edge<FamilyEdgeData, 'family'>;

const FOLD_SIZE = 36;

export function toFlow(result: LayoutResult, persons: Person[], selectedId: number | null) {
  const people = new Map(persons.map((person) => [person.id, person]));
  const nodes: FlowNode[] = [];

  for (const card of result.cards) {
    const person = people.get(card.id);
    if (!person) continue;
    nodes.push({
      id: String(card.id),
      type: 'person',
      position: { x: card.x, y: card.y },
      data: { person, selected: card.id === selectedId },
      width: card.width,
      height: card.height,
      draggable: false,
      connectable: false,
      selectable: false,
      focusable: false,
      class: 'nopan',
      style: { width: `${card.width}px`, height: `${card.height}px` },
    });
  }

  for (const fold of result.folds) {
    nodes.push({
      id: foldNodeId(fold.id),
      type: 'fold',
      position: { x: fold.x, y: fold.y },
      origin: [0.5, 0.5],
      data: { personId: fold.id, collapsed: fold.collapsed },
      width: FOLD_SIZE,
      height: FOLD_SIZE,
      zIndex: 2,
      draggable: false,
      connectable: false,
      selectable: false,
      focusable: false,
      class: 'nopan',
      style: {
        width: `${FOLD_SIZE}px`,
        height: `${FOLD_SIZE}px`,
        background: 'transparent',
        border: 'none',
        boxShadow: 'none',
      },
    });
  }

  const edges: FamilyEdge[] = result.lines.map((line, index) => ({
    id: `${line.kind}:${index}:${line.source}:${line.target}`,
    source: line.source,
    target: line.target,
    type: 'family',
    selectable: false,
    focusable: false,
    deletable: false,
    reconnectable: false,
    interactionWidth: 0,
    data: { d: line.d, kind: line.kind },
    style: {
      stroke: line.kind === 'marriage' ? COLORS.accent : COLORS.line,
      strokeWidth: line.kind === 'marriage' ? 1.5 : 1.25,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    },
  }));

  return { nodes, edges };
}

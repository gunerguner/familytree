import type { Marriage, ParentLink, Person } from '../api/types';

export function spousesOf(id: number, marriages: Marriage[]) {
  return marriages
    .filter((item) => item.aId === id || item.bId === id)
    .map((item) => ({ id: item.aId === id ? item.bId : item.aId, sortOrder: item.sortOrder }))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
}

export function childLinks(id: number, parents: ParentLink[]) {
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

export interface Person {
  id: number;
  name: string;
  kinship: string | null;
  formerName: string | null;
  nickname: string | null;
  birthText: string | null;
  deathText: string | null;
  narrative: string | null;
  birthYear: number | null;
  deceased: boolean;
  age: number | null;
}

export type ParentRole =
  | 'father'
  | 'stepfather'
  | 'mother'
  | 'stepmother'
  | 'adoptive_mother'
  | 'adoptive_father';

export interface ParentLink {
  childId: number;
  parentId: number;
  role: ParentRole;
  sortOrder: number;
}

export interface Marriage {
  id: number;
  aId: number;
  bId: number;
  label: string | null;
  sortOrder: number;
}

export interface TreeData {
  persons: Person[];
  parents: ParentLink[];
  marriages: Marriage[];
}

export interface PersonDetail extends Person {
  parents: { id: number; name: string; role: ParentRole; sortOrder: number }[];
  marriages: { personId: number; name: string; label: string | null; sortOrder: number }[];
  children: { id: number; name: string; role: ParentRole; sortOrder: number }[];
}

export interface PersonInput {
  name: string;
  kinship: string | null;
  formerName: string | null;
  nickname: string | null;
  birthText: string | null;
  deathText: string | null;
  narrative: string | null;
  parents: { personId: number; role: ParentRole; sortOrder: number }[];
  marriages: { personId: number; label: string | null; sortOrder: number }[];
}

export const ROLE_LABELS: Record<ParentRole, string> = {
  father: '父亲',
  stepfather: '继父',
  mother: '母亲',
  stepmother: '继母',
  adoptive_mother: '养母',
  adoptive_father: '养父',
};

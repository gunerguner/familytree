import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export const PARENT_ROLES = [
  'father',
  'stepfather',
  'mother',
  'stepmother',
  'adoptive_mother',
  'adoptive_father',
] as const;

export type ParentRole = (typeof PARENT_ROLES)[number];

@Entity('parent_links')
export class ParentLink {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'child_id', type: 'integer' })
  childId!: number;

  @Column({ name: 'parent_id', type: 'integer' })
  parentId!: number;

  @Column({ type: 'text' })
  role!: ParentRole;

  @Column({ name: 'sort_order', type: 'integer', default: 0 })
  sortOrder!: number;
}

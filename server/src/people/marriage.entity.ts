import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('marriages')
export class Marriage {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'a_id', type: 'integer' })
  aId!: number;

  @Column({ name: 'b_id', type: 'integer' })
  bId!: number;

  @Column({ type: 'text', nullable: true })
  label!: string | null;

  @Column({ name: 'sort_order', type: 'integer', default: 0 })
  sortOrder!: number;

  @Column({ type: 'integer', insert: false, update: false })
  lo!: number;

  @Column({ type: 'integer', insert: false, update: false })
  hi!: number;
}

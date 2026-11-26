import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('persons')
export class Person {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text' })
  sex!: 'male' | 'female';

  @Column({ type: 'text', nullable: true })
  kinship!: string | null;

  @Column({ name: 'former_name', type: 'text', nullable: true })
  formerName!: string | null;

  @Column({ type: 'text', nullable: true })
  nickname!: string | null;

  @Column({ name: 'birth_text', type: 'text', nullable: true })
  birthText!: string | null;

  @Column({ name: 'death_text', type: 'text', nullable: true })
  deathText!: string | null;

  @Column({ type: 'text', nullable: true })
  narrative!: string | null;

  @Column({ name: 'created_at', type: 'text' })
  createdAt!: string;

  @Column({ name: 'updated_at', type: 'text' })
  updatedAt!: string;
}

import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('sessions')
export class Session {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'account_id', type: 'integer' })
  accountId!: number;

  @Column({ name: 'token_hash', type: 'text', unique: true })
  tokenHash!: string;

  @Column({ name: 'expires_at', type: 'text' })
  expiresAt!: string;

  @Column({ name: 'created_at', type: 'text' })
  createdAt!: string;
}

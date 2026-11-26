import { mkdirSync } from 'fs';
import { dirname } from 'path';
import { DataSource } from 'typeorm';
import { Account } from '../auth/account.entity';
import { Session } from '../auth/session.entity';
import { Marriage } from '../people/marriage.entity';
import { ParentLink } from '../people/parent-link.entity';
import { Person } from '../people/person.entity';
import { InitMigration } from './init.migration';
import { SexBrotherInLawMigration } from './sex-brother-in-law.migration';
import { SexMigration } from './sex.migration';

export function createDataSource(): DataSource {
  const database = process.env.DATABASE_PATH;
  if (!database) {
    throw new Error('缺少 DATABASE_PATH');
  }
  if (database !== ':memory:') {
    mkdirSync(dirname(database), { recursive: true });
  }
  return new DataSource({
    type: 'better-sqlite3',
    database,
    entities: [Person, ParentLink, Marriage, Account, Session],
    migrations: [InitMigration, SexMigration, SexBrotherInLawMigration],
  });
}

export async function openDataSource(): Promise<DataSource> {
  const dataSource = createDataSource();
  await dataSource.initialize();
  await dataSource.query('PRAGMA foreign_keys = ON');
  await dataSource.query('PRAGMA journal_mode = WAL');
  await dataSource.query('PRAGMA busy_timeout = 5000');
  return dataSource;
}

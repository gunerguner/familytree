import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitMigration implements MigrationInterface {
  name = 'Init1700000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE persons (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        name         TEXT NOT NULL CHECK (length(trim(name)) > 0),
        kinship      TEXT,
        former_name  TEXT,
        nickname     TEXT,
        birth_text   TEXT,
        death_text   TEXT,
        narrative    TEXT,
        created_at   TEXT NOT NULL,
        updated_at   TEXT NOT NULL
      )
    `);
    await queryRunner.query(`
      CREATE TABLE parent_links (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        child_id    INTEGER NOT NULL REFERENCES persons(id),
        parent_id   INTEGER NOT NULL REFERENCES persons(id),
        role        TEXT NOT NULL CHECK (
                      role IN (
                        'father',
                        'stepfather',
                        'mother',
                        'stepmother',
                        'adoptive_mother',
                        'adoptive_father'
                      )
                    ),
        sort_order  INTEGER NOT NULL DEFAULT 0,
        CHECK (child_id <> parent_id),
        UNIQUE (child_id, parent_id)
      )
    `);
    await queryRunner.query(
      'CREATE INDEX parent_links_parent ON parent_links(parent_id)',
    );
    await queryRunner.query(
      'CREATE INDEX parent_links_child ON parent_links(child_id)',
    );
    await queryRunner.query(`
      CREATE TABLE marriages (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        a_id        INTEGER NOT NULL REFERENCES persons(id),
        b_id        INTEGER NOT NULL REFERENCES persons(id),
        label       TEXT,
        sort_order  INTEGER NOT NULL DEFAULT 0,
        lo          INTEGER GENERATED ALWAYS AS (
                      CASE WHEN a_id < b_id THEN a_id ELSE b_id END
                    ) STORED,
        hi          INTEGER GENERATED ALWAYS AS (
                      CASE WHEN a_id < b_id THEN b_id ELSE a_id END
                    ) STORED,
        CHECK (a_id <> b_id),
        UNIQUE (lo, hi)
      )
    `);
    await queryRunner.query('CREATE INDEX marriages_a ON marriages(a_id)');
    await queryRunner.query('CREATE INDEX marriages_b ON marriages(b_id)');
    await queryRunner.query(`
      CREATE TABLE accounts (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        username       TEXT NOT NULL UNIQUE,
        password_hash  TEXT NOT NULL,
        created_at     TEXT NOT NULL
      )
    `);
    await queryRunner.query(`
      CREATE TABLE sessions (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id   INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        token_hash   TEXT NOT NULL UNIQUE,
        expires_at   TEXT NOT NULL,
        created_at   TEXT NOT NULL
      )
    `);
    await queryRunner.query(
      'CREATE INDEX sessions_account ON sessions(account_id)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS sessions');
    await queryRunner.query('DROP TABLE IF EXISTS accounts');
    await queryRunner.query('DROP TABLE IF EXISTS marriages');
    await queryRunner.query('DROP TABLE IF EXISTS parent_links');
    await queryRunner.query('DROP TABLE IF EXISTS persons');
  }
}

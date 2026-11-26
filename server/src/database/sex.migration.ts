import { MigrationInterface, QueryRunner } from 'typeorm';

export class SexMigration implements MigrationInterface {
  name = 'Sex1700000001000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE persons
      ADD COLUMN sex TEXT NOT NULL DEFAULT 'male'
      CHECK (sex IN ('male', 'female'))
    `);
    await queryRunner.query(`
      UPDATE persons
      SET sex = 'female'
      WHERE (
          kinship LIKE '%女%'
          OR kinship LIKE '%母%'
          OR kinship LIKE '%姑%'
          OR kinship LIKE '%嫂%'
          OR kinship LIKE '%媳%'
          OR kinship LIKE '%姐%'
          OR kinship LIKE '%妹%'
          OR kinship LIKE '%妇%'
          OR kinship LIKE '%婆%'
          OR name LIKE '%氏'
          OR name LIKE '%夫人'
        )
        AND (kinship IS NULL OR (
          kinship NOT LIKE '%父%'
          AND kinship NOT LIKE '%婿%'
          AND kinship NOT LIKE '%姐夫%'
          AND kinship NOT LIKE '%妹夫%'
          AND kinship NOT LIKE '%丈夫%'
        ))
    `);
    await queryRunner.query(`
      UPDATE persons
      SET sex = 'female'
      WHERE id IN (
          SELECT parent_id FROM parent_links
          WHERE role IN ('mother', 'stepmother', 'adoptive_mother')
        )
        AND id NOT IN (
          SELECT parent_id FROM parent_links
          WHERE role IN ('father', 'stepfather', 'adoptive_father')
        )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE persons DROP COLUMN sex');
  }
}

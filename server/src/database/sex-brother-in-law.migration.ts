import { MigrationInterface, QueryRunner } from 'typeorm';

export class SexBrotherInLawMigration implements MigrationInterface {
  name = 'Sex1700000002000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE persons
      SET sex = 'male'
      WHERE kinship LIKE '%姐夫%'
        OR kinship LIKE '%妹夫%'
        OR kinship LIKE '%丈夫%'
    `);
  }

  async down(): Promise<void> {}
}

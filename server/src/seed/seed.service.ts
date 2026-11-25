import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DATA_SOURCE } from '../database/database.module';
import { shanghaiNow } from '../database/time';
import { Marriage } from '../people/marriage.entity';
import { ParentLink, ParentRole } from '../people/parent-link.entity';
import { Person } from '../people/person.entity';

interface SeedPerson {
  key: string;
  name: string;
  kinship: string | null;
  formerName: string | null;
  nickname: string | null;
  birthText: string | null;
  deathText: string | null;
  narrative: string | null;
}

interface SeedFile {
  persons: SeedPerson[];
  parents: { child: string; parent: string; role: ParentRole; sortOrder: number }[];
  marriages: { a: string; b: string; label: string | null; sortOrder: number }[];
}

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(@Inject(DATA_SOURCE) private readonly dataSource: DataSource) {}

  async seedIfEmpty(): Promise<void> {
    const count = await this.dataSource.getRepository(Person).count();
    if (count > 0) return;
    const path = this.seedPath();
    const raw = JSON.parse(readFileSync(path, 'utf8')) as SeedFile;
    await this.dataSource.transaction(async (manager) => {
      const ids = new Map<string, number>();
      const now = shanghaiNow();
      for (const person of raw.persons) {
        const saved = await manager.save(
          manager.create(Person, {
            name: person.name,
            kinship: person.kinship,
            formerName: person.formerName,
            nickname: person.nickname,
            birthText: person.birthText,
            deathText: person.deathText,
            narrative: person.narrative,
            createdAt: now,
            updatedAt: now,
          }),
        );
        ids.set(person.key, saved.id);
      }
      for (const link of raw.parents) {
        const childId = ids.get(link.child);
        const parentId = ids.get(link.parent);
        if (!childId || !parentId) throw new Error(`种子亲子引用了未知人物 ${link.child}/${link.parent}`);
        await manager.save(
          manager.create(ParentLink, {
            childId,
            parentId,
            role: link.role,
            sortOrder: link.sortOrder,
          }),
        );
      }
      for (const marriage of raw.marriages) {
        const aId = ids.get(marriage.a);
        const bId = ids.get(marriage.b);
        if (!aId || !bId) throw new Error(`种子婚姻引用了未知人物 ${marriage.a}/${marriage.b}`);
        await manager.save(
          manager.create(Marriage, {
            aId,
            bId,
            label: marriage.label,
            sortOrder: marriage.sortOrder,
          }),
        );
      }
    });
    this.logger.log(`已灌入种子 ${path}`);
  }

  private seedPath(): string {
    const candidates = [
      process.env.SEED_PATH,
      join(process.cwd(), 'seed/family.json'),
      join(__dirname, '../../seed/family.json'),
      join(__dirname, '../seed/family.json'),
    ].filter((item): item is string => Boolean(item));
    for (const path of candidates) {
      if (existsSync(path)) return path;
    }
    throw new Error('找不到种子文件 family.json');
  }
}

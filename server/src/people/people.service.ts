import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { DATA_SOURCE } from '../database/database.module';
import { shanghaiNow, shanghaiToday } from '../database/time';
import { deriveAge } from './age';
import { Marriage } from './marriage.entity';
import { ParentLink, ParentRole } from './parent-link.entity';
import { PersonInput } from './person.dto';
import { Person } from './person.entity';

const SORT_PRIORITY: ParentRole[] = [
  'father',
  'stepfather',
  'adoptive_father',
  'mother',
  'stepmother',
  'adoptive_mother',
];

function blank(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

@Injectable()
export class PeopleService {
  constructor(@Inject(DATA_SOURCE) private readonly dataSource: DataSource) {}

  async tree() {
    const persons = await this.dataSource.getRepository(Person).find({ order: { id: 'ASC' } });
    const parents = await this.dataSource.getRepository(ParentLink).find({ order: { id: 'ASC' } });
    const marriages = await this.dataSource.getRepository(Marriage).find({ order: { id: 'ASC' } });
    return {
      persons: persons.map((person) => this.view(person)),
      parents: parents.map((link) => ({
        childId: link.childId,
        parentId: link.parentId,
        role: link.role,
        sortOrder: link.sortOrder,
      })),
      marriages: marriages.map((marriage) => ({
        id: marriage.id,
        aId: marriage.aId,
        bId: marriage.bId,
        label: marriage.label,
        sortOrder: marriage.sortOrder,
      })),
    };
  }

  async detail(id: number) {
    const person = await this.dataSource.getRepository(Person).findOne({ where: { id } });
    if (!person) throw new NotFoundException({ error: '找不到这个人' });
    const parents = await this.dataSource.getRepository(ParentLink).find({ where: { childId: id } });
    const childLinks = await this.dataSource.getRepository(ParentLink).find({ where: { parentId: id } });
    const marriages = await this.dataSource
      .getRepository(Marriage)
      .createQueryBuilder('m')
      .where('m.a_id = :id OR m.b_id = :id', { id })
      .orderBy('m.sort_order', 'ASC')
      .addOrderBy('m.id', 'ASC')
      .getMany();
    const ids = new Set<number>();
    for (const link of parents) ids.add(link.parentId);
    for (const link of childLinks) ids.add(link.childId);
    for (const marriage of marriages) ids.add(marriage.aId === id ? marriage.bId : marriage.aId);
    const related = ids.size
      ? await this.dataSource
          .getRepository(Person)
          .createQueryBuilder('p')
          .where('p.id IN (:...ids)', { ids: [...ids] })
          .getMany()
      : [];
    const names = new Map(related.map((item) => [item.id, item.name]));
    return {
      ...this.view(person),
      parents: parents
        .map((link) => ({
          id: link.parentId,
          name: names.get(link.parentId) ?? '',
          role: link.role,
          sortOrder: link.sortOrder,
        }))
        .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id),
      marriages: marriages.map((marriage) => {
        const personId = marriage.aId === id ? marriage.bId : marriage.aId;
        return {
          personId,
          name: names.get(personId) ?? '',
          label: marriage.label,
          sortOrder: marriage.sortOrder,
        };
      }),
      children: childLinks
        .map((link) => ({
          id: link.childId,
          name: names.get(link.childId) ?? '',
          role: link.role,
          sortOrder: link.sortOrder,
        }))
        .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id),
    };
  }

  async create(input: PersonInput) {
    const id = await this.dataSource.transaction(async (manager) => {
      const now = shanghaiNow();
      const saved = await manager.save(
        Person,
        manager.create(Person, { ...this.fields(input), createdAt: now, updatedAt: now }),
      );
      await this.replaceRelations(manager, saved.id, input);
      return saved.id;
    });
    return this.detail(id);
  }

  async update(id: number, input: PersonInput) {
    await this.dataSource.transaction(async (manager) => {
      const existing = await manager.findOne(Person, { where: { id } });
      if (!existing) throw new NotFoundException({ error: '找不到这个人' });
      await manager.update(Person, id, { ...this.fields(input), updatedAt: shanghaiNow() });
      await this.replaceRelations(manager, id, input);
    });
    return this.detail(id);
  }

  async remove(id: number): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const existing = await manager.findOne(Person, { where: { id } });
      if (!existing) throw new NotFoundException({ error: '找不到这个人' });
      await manager
        .createQueryBuilder()
        .delete()
        .from(ParentLink)
        .where('child_id = :id OR parent_id = :id', { id })
        .execute();
      await manager
        .createQueryBuilder()
        .delete()
        .from(Marriage)
        .where('a_id = :id OR b_id = :id', { id })
        .execute();
      await manager.delete(Person, id);
    });
  }

  private fields(input: PersonInput) {
    const name = input.name.trim();
    if (!name) {
      throw new UnprocessableEntityException({
        error: '姓名不能为空',
        fields: { name: '姓名不能为空' },
      });
    }
    return {
      name,
      sex: input.sex,
      kinship: blank(input.kinship),
      formerName: blank(input.formerName),
      nickname: blank(input.nickname),
      birthText: blank(input.birthText),
      deathText: blank(input.deathText),
      narrative: blank(input.narrative),
    };
  }

  // 校验父母/配偶引用：不能重复、不能指向自己、引用的人都必须存在
  private async assertRelationsValid(manager: EntityManager, id: number, input: PersonInput) {
    const parentIds = input.parents.map((item) => item.personId);
    const spouseIds = input.marriages.map((item) => item.personId);
    if (new Set(parentIds).size !== parentIds.length) {
      throw new UnprocessableEntityException({ error: '父母里有重复的人' });
    }
    if (new Set(spouseIds).size !== spouseIds.length) {
      throw new UnprocessableEntityException({ error: '同一段婚姻不能重复' });
    }
    const pairKeys = input.marriages.map((item) => {
      const lo = Math.min(id, item.personId);
      const hi = Math.max(id, item.personId);
      return `${lo}:${hi}`;
    });
    if (new Set(pairKeys).size !== pairKeys.length) {
      throw new UnprocessableEntityException({ error: '同一段婚姻不能重复' });
    }
    const referenced = [...new Set([...parentIds, ...spouseIds])];
    if (referenced.some((personId) => personId === id)) {
      throw new UnprocessableEntityException({ error: '不能指向自己' });
    }
    if (referenced.length) {
      const found = await manager
        .createQueryBuilder(Person, 'p')
        .where('p.id IN (:...ids)', { ids: referenced })
        .getMany();
      if (found.length !== referenced.length) {
        throw new UnprocessableEntityException({ error: '引用的人物不存在' });
      }
    }
  }

  // 用提交内容整体替换此人的父母链接与婚姻记录
  private async writeRelations(manager: EntityManager, id: number, input: PersonInput) {
    await manager.createQueryBuilder().delete().from(ParentLink).where('child_id = :id', { id }).execute();
    await manager
      .createQueryBuilder()
      .delete()
      .from(Marriage)
      .where('a_id = :id OR b_id = :id', { id })
      .execute();
    const sortOrder = this.unifiedSort(input);
    if (input.parents.length) {
      await manager.save(
        ParentLink,
        input.parents.map((item) =>
          manager.create(ParentLink, {
            childId: id,
            parentId: item.personId,
            role: item.role,
            sortOrder,
          }),
        ),
      );
    }
    if (input.marriages.length) {
      await manager.save(
        Marriage,
        input.marriages.map((item) =>
          manager.create(Marriage, {
            aId: id,
            bId: item.personId,
            label: blank(item.label),
            sortOrder: item.sortOrder ?? 0,
          }),
        ),
      );
    }
  }

  private async replaceRelations(manager: EntityManager, id: number, input: PersonInput) {
    await this.assertRelationsValid(manager, id, input);
    await this.writeRelations(manager, id, input);
    if (await this.hasCycle(manager)) {
      throw new ConflictException({ error: '这样会把祖先收成自己的后代' });
    }
  }

  private unifiedSort(input: PersonInput): number {
    for (const role of SORT_PRIORITY) {
      const found = input.parents.find((item) => item.role === role);
      if (found) return found.sortOrder ?? 0;
    }
    return 0;
  }

  private async hasCycle(manager: EntityManager): Promise<boolean> {
    const links = await manager.find(ParentLink);
    const parentsOf = new Map<number, number[]>();
    const nodes = new Set<number>();
    for (const link of links) {
      nodes.add(link.childId);
      nodes.add(link.parentId);
      const list = parentsOf.get(link.childId) ?? [];
      list.push(link.parentId);
      parentsOf.set(link.childId, list);
    }
    const state = new Map<number, number>();
    const visit = (id: number): boolean => {
      const mark = state.get(id) ?? 0;
      if (mark === 1) return true;
      if (mark === 2) return false;
      state.set(id, 1);
      for (const parent of parentsOf.get(id) ?? []) {
        if (visit(parent)) return true;
      }
      state.set(id, 2);
      return false;
    };
    for (const id of nodes) {
      if (visit(id)) return true;
    }
    return false;
  }

  private view(person: Person) {
    const derived = deriveAge(person.birthText, person.deathText, shanghaiToday());
    return {
      id: person.id,
      name: person.name,
      sex: person.sex,
      kinship: person.kinship,
      formerName: person.formerName,
      nickname: person.nickname,
      birthText: person.birthText,
      deathText: person.deathText,
      narrative: person.narrative,
      birthYear: derived.birthYear,
      deceased: derived.deceased,
      age: derived.age,
    };
  }
}

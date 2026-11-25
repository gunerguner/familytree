import { Global, Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { openDataSource } from './data-source';

export const DATA_SOURCE = 'DATA_SOURCE';

@Global()
@Module({
  providers: [
    {
      provide: DATA_SOURCE,
      useFactory: () => openDataSource(),
    },
  ],
  exports: [DATA_SOURCE],
})
export class DatabaseModule {}

export function repositoryToken(entity: { name: string }): string {
  return `${entity.name}Repository`;
}

export function injectDataSource(): typeof DATA_SOURCE {
  return DATA_SOURCE;
}

export type AppDataSource = DataSource;

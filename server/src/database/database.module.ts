import { Global, Module } from '@nestjs/common';
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

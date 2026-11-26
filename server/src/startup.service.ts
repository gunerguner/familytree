import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuthService } from './auth/auth.service';
import { DATA_SOURCE } from './database/database.module';
import { SeedService } from './seed/seed.service';

@Injectable()
export class StartupService implements OnModuleInit {
  constructor(
    @Inject(DATA_SOURCE) private readonly dataSource: DataSource,
    private readonly auth: AuthService,
    private readonly seed: SeedService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.dataSource.runMigrations();
    await this.auth.ensureBootstrapAccount();
    await this.seed.seedIfEmpty();
  }
}

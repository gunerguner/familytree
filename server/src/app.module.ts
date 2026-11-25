import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health/health.controller';
import { PeopleModule } from './people/people.module';
import { SeedService } from './seed/seed.service';
import { StartupService } from './startup.service';

const staticDir = process.env.STATIC_DIR;

@Module({
  imports: [
    ...(staticDir
      ? [
          ServeStaticModule.forRoot({
            rootPath: staticDir,
            exclude: /^\/api(\/|$)/,
          }),
        ]
      : []),
    DatabaseModule,
    AuthModule,
    PeopleModule,
  ],
  controllers: [HealthController],
  providers: [SeedService, StartupService],
})
export class AppModule {}

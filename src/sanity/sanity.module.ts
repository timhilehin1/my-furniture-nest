import { Module } from '@nestjs/common';
import { SanityService } from './sanity.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createClient } from '@sanity/client';

@Module({
  imports:[ConfigModule],
  providers: [{
    provide: 'SANITY_CLIENT',
    inject:[ConfigService],
    useFactory: (configService: ConfigService) =>{
      return createClient ({
          projectId: configService.get<string>('SANITY_PROJECT_ID'),
          dataset: configService.get<string>('SANITY_DATASET'),
          apiVersion:configService.get<string>('SANITY_API_VERSION'),
          // token:configService.get<string>('SANITY_API_TOKEN'),
          useCdn: true
      })
    }
  },
  SanityService
],
  exports: [SanityService]
})
export class SanityModule {}

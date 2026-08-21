import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProfileModule } from './profile/profile.module';
import { JwtConfigModule } from './jwt-config/jwt-config.module';
import { CartModule } from './cart/cart.module';
import { SanityModule } from './sanity/sanity.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ProfileModule,
    CartModule,
    JwtConfigModule,
    SanityModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}

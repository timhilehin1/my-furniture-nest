import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from 'src/users/users.module';
import { ProfileModule } from 'src/profile/profile.module';
import { JwtConfigModule } from 'src/jwt-config/jwt-config.module';
@Module({
  providers: [AuthService],
  controllers: [AuthController],
  imports:[UsersModule, ProfileModule, JwtConfigModule],
})
export class AuthModule {}

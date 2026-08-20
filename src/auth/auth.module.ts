import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from 'src/users/users.module';
import { JwtConfigModule } from 'src/jwt-config/jwt-config.module';
import { AuthGuard } from './auth.guard';
@Module({
  providers: [AuthService, AuthGuard],
  controllers: [AuthController],
  imports:[UsersModule, JwtConfigModule],
  exports:[AuthGuard, UsersModule, JwtConfigModule]
})
export class AuthModule {}

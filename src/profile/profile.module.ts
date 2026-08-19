import { Module } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { UsersService } from 'src/users/users.service';
import { UsersModule } from 'src/users/users.module';
import { ProfileController } from './profile.controller';
import { JwtConfigModule } from 'src/jwt-config/jwt-config.module';
import { AuthGuard } from 'src/auth/auth.guard';

@Module({
  providers: [ProfileService, AuthGuard],
  exports: [ProfileService],
  imports:[UsersModule, JwtConfigModule],
  controllers:[ProfileController]
})
export class ProfileModule {}


// user should be able to hit profile endpoint 
// user must be a valid user before requesting for profile details 
// user should be authnticated before getting profile details 

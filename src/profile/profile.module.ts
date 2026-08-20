import { Module } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { UsersModule } from 'src/users/users.module';
import { ProfileController } from './profile.controller';
import { JwtConfigModule } from 'src/jwt-config/jwt-config.module';
import { AuthModule } from 'src/auth/auth.module';


@Module({
  providers: [ProfileService],
  exports: [ProfileService],
  imports:[UsersModule, JwtConfigModule, AuthModule],
  controllers:[ProfileController,]
})
export class ProfileModule {}


// user should be able to hit profile endpoint 
// user must be a valid user before requesting for profile details 
// user should be authnticated before getting profile details 

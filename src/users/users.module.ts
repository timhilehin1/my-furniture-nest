import { Module } from '@nestjs/common';
import { UsersService } from './users.service';

@Module({
  providers: [UsersService], //users modules owns and manages usersService
    exports:[UsersService] //users service allows other modules to use userservice
})
export class UsersModule {}

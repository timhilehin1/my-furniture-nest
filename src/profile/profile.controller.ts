import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { AuthGuard } from 'src/auth/auth.guard';
import {ApiTags, ApiBearerAuth} from '@nestjs/swagger'

@ApiBearerAuth()
@ApiTags('profile')
@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}
  @UseGuards(AuthGuard)
  @Get()
  profile(@Request() request: any){
    return this.profileService.getprofile(request.user);
  }
}

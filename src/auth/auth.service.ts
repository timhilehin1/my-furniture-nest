import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { RegisterDto } from './dto/register';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}
  async register(data: RegisterDto) {
    const existingUser = await this.usersService.findByEmail(data.email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }
    const hashedPassword = await bcrypt.hash(data.password, 10);
    const user = await this.usersService.create({
      ...data,
      password: hashedPassword,
    });
    return user;
  }

  async login(data: LoginDto) {
    const existingUser = await this.usersService.findByEmail(data.email);
    if (!existingUser) {
      throw new BadRequestException('Email or password incorrect');
    }
    const isMatch = await bcrypt.compare(data.password, existingUser.password);
    if (!isMatch) {
      throw new BadRequestException('Email or password incorrect');
    }
    const accessToken = this.jwtService.sign({ id: existingUser.id });
    const refreshToken = this.jwtService.sign(
      { id: existingUser.id, type: 'refresh' },
      { expiresIn: '7d' },
    );
    const { password, ...user } = existingUser;

    return {
      ...user,
      accessToken,
      refreshToken,
    };
  }
}

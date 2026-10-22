import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { RegisterDto } from '../dto/register.dto';
import * as bcrypt from 'bcrypt';
import { LoginDto } from '../dto/login.dto';
import { JwtService } from '@nestjs/jwt';
import { AccessTokenPayload } from 'src/interface/token';

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
    return { ...user, ...this.generateTokens(user.id) };
  }

  async login(data: LoginDto) {
    const existingUser = await this.usersService.findByEmailWithPassword(
      data.email,
    );
    if (!existingUser) {
      throw new BadRequestException('Email or password incorrect');
    }
    const isMatch = await bcrypt.compare(data.password, existingUser.password);
    if (!isMatch) {
      throw new BadRequestException('Email or password incorrect');
    }
    const { password, ...user } = existingUser;
    return { ...user, ...this.generateTokens(user.id) };
  }

  async refresh(refreshToken: string) {
    let payload: AccessTokenPayload;
    try {
      payload = this.jwtService.verify<AccessTokenPayload>(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.usersService.findById(payload.id);
    if (!user) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.generateTokens(user.id);
  }

  private generateTokens(userId: string) {
    const accessToken = this.jwtService.sign({ id: userId });
    const refreshToken = this.jwtService.sign(
      { id: userId, type: 'refresh' },
      { expiresIn: '7d' },
    );
    return { accessToken, refreshToken };
  }
}

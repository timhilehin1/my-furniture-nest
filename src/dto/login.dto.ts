import { IsEmail, MinLength } from 'class-validator';
import {ApiProperty} from "@nestjs/swagger"
export class LoginDto{
    @ApiProperty({ example: 'timilehin@gmail.com' })
    @IsEmail()
    email: string;

    @ApiProperty({ example: 'Password123' })
    @MinLength(8)
    password: string

}
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import {ApiProperty} from "@nestjs/swagger"
export class RegisterDto {
    @ApiProperty({ example: 'timilehin@gmail.com' })
    @IsEmail()
    email: string;

    @ApiProperty({ example: 'Password123', minLength: 8 })
    @MinLength(8)
    password: string

    @ApiProperty({ example: 'Timilehin' })
    @IsString() @IsNotEmpty()
    firstName:string;

    @ApiProperty({ example: 'Oladapo' })
    @IsString() @IsNotEmpty()
    lastName:string;
}
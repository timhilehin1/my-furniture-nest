import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CheckoutDto {
  @ApiProperty({ example: '23 opebbi road' })
  @IsString()
  @IsNotEmpty()
  shippingAddress: string;

  @ApiProperty({ example: 'Lagos' })
  @IsString()
  @IsNotEmpty()
  shippingCity: string;

  @ApiProperty({ example: 'Lagos' })
  @IsString()
  @IsNotEmpty()
  shippingState: string;

  @ApiPropertyOptional({ example: '100001' })
  @IsString()
  @IsOptional()
  shippingZipcode?: string;

  @ApiProperty({ example: 'Nigeria' })
  @IsString()
  @IsNotEmpty()
  shippingCountry: string;

  @ApiProperty({ example: '08038109620' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: 'tim@example.com' })
  @IsEmail()
  email: string;
}

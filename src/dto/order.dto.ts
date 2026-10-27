import { IsEmail, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min} from 'class-validator';
import {Type} from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus } from 'src/generated/prisma/enums';

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

export class GetOrdersQueryDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(999)
  page: number = 1;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 10;

  @ApiPropertyOptional({ enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;
}

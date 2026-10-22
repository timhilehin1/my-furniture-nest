import { IsString, IsNotEmpty, IsInt, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddCartDto {
  @ApiProperty({
    example: '140f3204-68cd-4043-96df-2567082f4009',
    description: 'Sanity product _id',
  })
  @IsString()
  @IsNotEmpty()
  productId: string;

  @ApiPropertyOptional({ example: 2, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;
}

export class UpdateCartDto {
  @ApiProperty({ example: 3 })
  @IsInt()
  @Min(1)
  quantity: number;
}

export class UpdateCartParamsDto {
  @ApiProperty({
    example: '140f3204-68cd-4043-96df-2567082f4009',
    description: 'Sanity product _id',
  })
  @IsString()
  @IsNotEmpty()
  productId: string;
}

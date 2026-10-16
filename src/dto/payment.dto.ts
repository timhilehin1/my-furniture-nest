import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class InitPaymentDto {
  @ApiProperty({ example: 'test-order-id', description: 'Order ID' })
  @IsString()
  @IsNotEmpty()
  orderId: string;
}

import {
  Body,
  Controller,
  Post,
  UseGuards,
  Request,
  Get,
  Param,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'src/auth/auth.guard';
import { OrdersService } from './orders.service';
import { CheckoutDto } from 'src/dto/order.dto';
@ApiBearerAuth()
@ApiTags('orders')
@Controller('orders')
@UseGuards(AuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}
  @Post('checkout')
  checkout(@Body() dto: CheckoutDto, @Request() request: any) {
    return this.ordersService.createOrder(request.user.id, dto);
  }

  @Get(':id/status')
  getOrderStatus(@Param('id') id: string, @Request() request: any) {
    return this.ordersService.getOrderStatus(request.user.id, id);
  }
}

import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { CartModule } from 'src/cart/cart.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  providers: [OrdersService],
  controllers: [OrdersController],
  imports: [CartModule, AuthModule],
})
export class OrdersModule {}

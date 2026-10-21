import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { CartModule } from 'src/cart/cart.module';
import { AuthModule } from 'src/auth/auth.module';
// okay that's the reason why we have providers in every of our odule is that next js create this incase any body else needs this create and give them and this happens via dependency injection
//what constructor does inside a class is that it tellss nest js that i need this service, i know you have created it so hadn it over, this way we dont have to create new instances everytime we need
@Module({
  providers: [OrdersService],
  controllers: [OrdersController],
  imports: [CartModule, AuthModule],
})
export class OrdersModule {}

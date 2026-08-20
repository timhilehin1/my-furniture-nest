import { Module } from '@nestjs/common';
import { CartService } from './cart.service';
import { AuthModule } from 'src/auth/auth.module';
import { SanityModule } from 'src/sanity/sanity.module';
import { CartController } from './cart.controller';


@Module({
  providers: [CartService],
  exports:[CartService],
  imports:[AuthModule, SanityModule],
  controllers: [CartController]
})
export class CartModule {}

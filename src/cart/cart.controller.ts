import { Controller, UseGuards, Post, Body, Request, Get, Put, Param, Delete } from '@nestjs/common';
import { CartService } from './cart.service';
import { AuthGuard } from 'src/auth/auth.guard';
import { AddCartDto, UpdateCartDto, UpdateCartParamsDto } from 'src/dto/cart.dto';
import {ApiTags,ApiBearerAuth} from '@nestjs/swagger'
//i dont curreny have the request that is resolved after the interceptor typed, that is why i am using any
@ApiBearerAuth()
@ApiTags('cart')
@Controller('cart')
@UseGuards(AuthGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}
  @Post()
  add(@Body() dto:AddCartDto, @Request() request:any ) {
    return this.cartService.addToCart(dto, request.user.id )
  }

  @Get()
  get(@Request() request:any){
   return this.cartService.buildCart(request.user.id)  
  }

  @Put(':productId')
  update(   @Param() params: UpdateCartParamsDto,
  @Body() dto: UpdateCartDto,
  @Request() request: any){
     return this.cartService.updateCart(dto, params.productId,  request.user.id)
  }

   @Delete(':productId')
   deleteSingleItem( @Param() params: UpdateCartParamsDto,   @Request() request: any ){
        return this.cartService.deleteSingleCartItem(params.productId, request.user.id)
   }

  @Delete()
   deleteAll(@Request() request:any ){
        return this.cartService.deleteAllCartItem(request.user.id)
   }

  
}

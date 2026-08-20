import { IsString, IsNotEmpty, IsNumber, IsOptional } from "class-validator";

export class AddCartDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsNumber()
  @IsOptional()
  quantity?: number;
}

export class UpdateCartDto {
  @IsNumber()
  quantity: number;
}

export class UpdateCartParamsDto {
  @IsString()
  @IsNotEmpty()
  productId: string;
}


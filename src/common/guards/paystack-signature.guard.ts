import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { Request } from 'express';
@Injectable()
export class PaystackSignatureGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const paystackHash = request.headers['x-paystack-signature']; // request coming from paystack
    const paystackSecretKey = this.configService.get('PAYSTACK_SECRET_KEY'); //secret key gotten from their dashboard
    const rawBody = request.body; //body of request
    if (!Buffer.isBuffer(rawBody))
      throw new UnauthorizedException('Invalid signature');
    const serverHash = crypto
      .createHmac('sha512', paystackSecretKey)
      .update(rawBody)
      .digest('hex');

    if (typeof paystackHash !== 'string' || paystackHash.length !== serverHash.length) {
      throw new UnauthorizedException('Invalid signature');
    }
    const isValid = crypto.timingSafeEqual(
      Buffer.from(serverHash),
      Buffer.from(paystackHash),
    );
    if (!isValid) {
      throw new UnauthorizedException('Unauthorized');
    }
    return true;
  }
}

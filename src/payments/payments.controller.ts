import { Body, Controller, Post, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'src/auth/auth.guard';
import { PaymentsService } from './payments.service';
import { InitPaymentDto } from 'src/dto/payment.dto';
import { PaystackSignatureGuard } from 'src/common/guards/paystack-signature.guard';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}
  @Post('initiate')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  initiatePayment(@Body() dto: InitPaymentDto, @Request() request: any) {
    return this.paymentsService.initiatePayment(request.user.id, dto.orderId);
  }

  @Post('webhook')
  @UseGuards(PaystackSignatureGuard)
  handleWebhook(@Body() paystackBody : Buffer){
    return this.paymentsService.handleWebhook(paystackBody)
  }

}

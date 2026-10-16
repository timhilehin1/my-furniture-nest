import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  providers: [PaymentsService],
  exports: [PaymentsService],
  imports: [AuthModule],
  controllers: [PaymentsController],
})
export class PaymentsModule {}

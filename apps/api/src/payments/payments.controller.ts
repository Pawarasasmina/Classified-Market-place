import { Body, Controller, Headers, Param, Post } from '@nestjs/common';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('webhooks/:provider')
  handleWebhook(
    @Param('provider') provider: string,
    @Body() payload: unknown,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    return this.paymentsService.handleWebhook(provider, payload, headers);
  }
}

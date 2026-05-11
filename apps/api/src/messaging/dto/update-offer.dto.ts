import { IsIn } from 'class-validator';

export class UpdateOfferDto {
  @IsIn(['ACCEPTED', 'DECLINED'])
  status!: 'ACCEPTED' | 'DECLINED';
}

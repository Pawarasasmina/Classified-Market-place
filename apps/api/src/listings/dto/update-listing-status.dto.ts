import { IsIn } from 'class-validator';

export class UpdateListingStatusDto {
  @IsIn(['publish', 'archive', 'mark_sold', 'delete'])
  action!: 'publish' | 'archive' | 'mark_sold' | 'delete';
}

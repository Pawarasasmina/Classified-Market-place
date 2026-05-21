import {
  Controller,
  Body,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UploadListingImageDto } from './dto/upload-listing-image.dto';
import { MAX_LISTING_IMAGE_BYTES } from './media.constants';
import { MediaService } from './media.service';
import type { UploadedImageFile } from './media.service';

@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('listing-images')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_LISTING_IMAGE_BYTES, files: 1 },
    }),
  )
  uploadListingImage(
    @CurrentUser() user: { id: string; role?: string },
    @Body() dto: UploadListingImageDto,
    @UploadedFile() file?: UploadedImageFile,
  ) {
    return this.mediaService.uploadListingImage(user, file, dto.listingId);
  }
}

import { Module } from '@nestjs/common';
import { imageStorageAdapterProvider } from './image-storage.provider';
import { LocalImageStorageAdapter } from './local-image-storage.adapter';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';

@Module({
  controllers: [MediaController],
  providers: [
    MediaService,
    LocalImageStorageAdapter,
    imageStorageAdapterProvider,
  ],
  exports: [MediaService],
})
export class MediaModule {}

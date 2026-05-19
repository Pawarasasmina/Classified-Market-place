import { Module } from '@nestjs/common';
import { IMAGE_STORAGE_ADAPTER } from './image-storage.adapter';
import { LocalImageStorageAdapter } from './local-image-storage.adapter';
import { MediaService } from './media.service';

@Module({
  providers: [
    MediaService,
    LocalImageStorageAdapter,
    {
      provide: IMAGE_STORAGE_ADAPTER,
      useExisting: LocalImageStorageAdapter,
    },
  ],
  exports: [MediaService],
})
export class MediaModule {}

import { Module } from '@nestjs/common';
import { KedbController } from './kedb.controller';
import { KedbService } from './kedb.service';

@Module({
  controllers: [KedbController],
  providers: [KedbService],
})
export class KedbModule {}

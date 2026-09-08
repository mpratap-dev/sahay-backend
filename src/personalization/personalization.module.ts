import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MeController } from './me.controller';
import { PersonalizationService } from './personalization.service';
import { InterestAreasController, TopicsController } from './topics.controller';

@Module({
  imports: [AuthModule],
  controllers: [TopicsController, InterestAreasController, MeController],
  providers: [PersonalizationService],
})
export class PersonalizationModule {}

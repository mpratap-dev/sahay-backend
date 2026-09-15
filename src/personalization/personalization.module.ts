import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GoogleGeocodeClient } from './google-geocode.client';
import { MeController } from './me.controller';
import { PersonalizationService } from './personalization.service';
import { InterestAreasController, TopicsController } from './topics.controller';

@Module({
  imports: [AuthModule],
  controllers: [TopicsController, InterestAreasController, MeController],
  providers: [PersonalizationService, GoogleGeocodeClient],
})
export class PersonalizationModule {}

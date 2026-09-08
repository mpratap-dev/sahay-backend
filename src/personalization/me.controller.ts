import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUserId } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InterestArea } from '../generated/prisma/enums';
import {
  LocationViewDto,
  PatchTopicsDto,
  PersonalizationResponseDto,
  ReplaceInterestAreasDto,
  TopicPreferencesDto,
  UpsertLocationDto,
} from './dto/personalization.dto';
import { PersonalizationService } from './personalization.service';

@ApiTags('me')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('me')
export class MeController {
  constructor(private readonly personalization: PersonalizationService) {}

  @Get('personalization')
  @ApiOkResponse({ type: PersonalizationResponseDto })
  getPersonalization(
    @CurrentUserId() userId: string,
  ): Promise<PersonalizationResponseDto> {
    return this.personalization.getPersonalization(userId);
  }

  @Put('location')
  @ApiOkResponse({ type: LocationViewDto })
  upsertLocation(
    @CurrentUserId() userId: string,
    @Body() body: UpsertLocationDto,
  ): Promise<LocationViewDto> {
    return this.personalization.upsertCurrentLocation(userId, body);
  }

  @Put('interest-areas')
  @ApiOkResponse()
  replaceInterestAreas(
    @CurrentUserId() userId: string,
    @Body() body: ReplaceInterestAreasDto,
  ): Promise<{ interestAreas: InterestArea[] }> {
    return this.personalization.replaceInterestAreas(userId, body);
  }

  @Get('topics')
  @ApiOkResponse({ type: TopicPreferencesDto })
  getTopics(@CurrentUserId() userId: string): Promise<TopicPreferencesDto> {
    return this.personalization.getTopicPreferences(userId);
  }

  @Put('topics')
  @ApiOkResponse({ type: TopicPreferencesDto })
  patchTopics(
    @CurrentUserId() userId: string,
    @Body() body: PatchTopicsDto,
  ): Promise<TopicPreferencesDto> {
    return this.personalization.patchTopics(userId, body);
  }
}

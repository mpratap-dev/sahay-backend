import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { InterestAreaViewDto, TopicViewDto } from './dto/personalization.dto';
import { PersonalizationService } from './personalization.service';

@ApiTags('topics')
@Controller('topics')
export class TopicsController {
  constructor(private readonly personalization: PersonalizationService) {}

  @Get()
  @ApiOkResponse({ type: [TopicViewDto] })
  listTopics(): Promise<TopicViewDto[]> {
    return this.personalization.listTopics();
  }
}

@ApiTags('interest-areas')
@Controller('interest-areas')
export class InterestAreasController {
  constructor(private readonly personalization: PersonalizationService) {}

  @Get()
  @ApiOkResponse({ type: [InterestAreaViewDto] })
  listInterestAreas(): Promise<InterestAreaViewDto[]> {
    return this.personalization.listInterestAreas();
  }
}

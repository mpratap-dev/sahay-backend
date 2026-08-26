import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ContentService } from './content.service';
import { ContentQueryDto } from './dto/content-query.dto';
import { ContentListResponseDto } from './dto/content-response.dto';

@ApiTags('content')
@Controller('content')
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @Get()
  @ApiOkResponse({ type: ContentListResponseDto })
  findAll(@Query() query: ContentQueryDto): Promise<ContentListResponseDto> {
    return this.contentService.findAll(query);
  }
}

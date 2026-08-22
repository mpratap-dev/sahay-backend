import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ArticlesService } from './articles.service';
import { ArticleQueryDto } from './dto/article-query.dto';
import {
  ArticleDetailDto,
  ArticleListResponseDto,
} from './dto/article-response.dto';

@ApiTags('articles')
@Controller('articles')
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Get()
  @ApiOkResponse({ type: ArticleListResponseDto })
  findAll(@Query() query: ArticleQueryDto): Promise<ArticleListResponseDto> {
    return this.articlesService.findAll(query);
  }

  @Get(':id')
  @ApiOkResponse({ type: ArticleDetailDto })
  @ApiNotFoundResponse({ description: 'Article not found' })
  findById(@Param('id') id: string): Promise<ArticleDetailDto> {
    return this.articlesService.findById(id);
  }
}

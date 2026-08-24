import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchDto } from './dto/search.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

type AuthenticatedUser = {
    id: string;
    email: string;
};

@Controller('search')
@UseGuards(JwtAuthGuard)
export class SearchController {
    constructor(private readonly searchService: SearchService) {}

    @Post()
    search(
        @CurrentUser() user: AuthenticatedUser,
        @Body() searchDto: SearchDto,
    ) {
        return this.searchService.search(user.id, searchDto.query);
    }
}

import { IsString, MaxLength, MinLength } from 'class-validator';

export class SearchDto {
    @IsString()
    @MinLength(2)
    @MaxLength(1000)
    query!: string;
}

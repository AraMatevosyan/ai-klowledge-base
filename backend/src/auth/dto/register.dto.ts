import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
    @Transform(({ value }: { value: unknown }) => {
        if (typeof value !== 'string') {
            return value;
        }

        return value.trim().toLowerCase();
    })
    @IsEmail()
    @MaxLength(254)
    email!: string;

    @IsString()
    @MinLength(8)
    @MaxLength(72)
    password!: string;
}

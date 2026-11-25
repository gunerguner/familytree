import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { PersonInput } from './person.dto';
import { PeopleService } from './people.service';

@Controller()
export class PeopleController {
  constructor(private readonly people: PeopleService) {}

  @Get('tree')
  tree() {
    return this.people.tree();
  }

  @Get('persons/:id')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.people.detail(id);
  }

  @Post('persons')
  @HttpCode(201)
  create(@Body() body: PersonInput) {
    return this.people.create(body);
  }

  @Patch('persons/:id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: PersonInput) {
    return this.people.update(id, body);
  }

  @Delete('persons/:id')
  @HttpCode(204)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.people.remove(id);
  }
}

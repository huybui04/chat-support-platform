import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from '../../database/entities';
import { ChatModule } from '../chat/chat.module';
import { KeycloakAdminService } from './keycloak-admin.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User]), ChatModule],
  controllers: [UsersController],
  providers: [UsersService, KeycloakAdminService],
  exports: [UsersService],
})
export class UsersModule {}

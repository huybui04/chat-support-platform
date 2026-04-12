import { TypeOrmModuleOptions } from '@nestjs/typeorm';

import { ALL_ENTITIES } from './entities/all-entities';

export function getTypeOrmConfig(): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USERNAME ?? 'pinnacle',
    password: process.env.DB_PASSWORD ?? 'pinnacle',
    // database: process.env.DB_NAME ?? 'chat_support_platform',
    database: process.env.DB_NAME ?? 'InternFSOFT',
    entities: ALL_ENTITIES,
    synchronize: process.env.NODE_ENV !== 'production',
  };
}

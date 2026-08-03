import 'reflect-metadata';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { MessageController } from './message.controller';

describe('MessageController', () => {
  it('exclut le rôle Ministry des échanges nominaux', () => {
    expect(Reflect.getMetadata(ROLES_KEY, MessageController)).toEqual([
      'STUDENT',
      'SCHOOL_ADMIN',
      'TEACHER',
      'ADMIN_GET',
    ]);
  });
});

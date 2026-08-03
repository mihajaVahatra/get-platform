import 'reflect-metadata';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { ApplicationController } from './application.controller';

function methodMetadataTarget(target: object, name: string): object {
  const value: unknown = Object.getOwnPropertyDescriptor(target, name)?.value;
  if (typeof value !== 'function') {
    throw new Error(`Méthode introuvable : ${name}`);
  }
  return value;
}

describe('ApplicationController', () => {
  it('exclut le rôle Ministry des détails et documents de candidature', () => {
    const getApplication = methodMetadataTarget(
      ApplicationController.prototype,
      'getApplication',
    );
    const getApplicationDocuments = methodMetadataTarget(
      ApplicationController.prototype,
      'getApplicationDocuments',
    );

    expect(Reflect.getMetadata(ROLES_KEY, getApplication)).toEqual([
      'STUDENT',
      'SCHOOL_ADMIN',
      'ADMIN_GET',
    ]);
    expect(Reflect.getMetadata(ROLES_KEY, getApplicationDocuments)).toEqual([
      'STUDENT',
      'SCHOOL_ADMIN',
      'ADMIN_GET',
    ]);
  });
});

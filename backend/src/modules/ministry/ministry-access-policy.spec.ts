import 'reflect-metadata';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { AuditController } from '../audit/audit.controller';
import { NotificationController } from '../notification/notification.controller';
import { PaymentController } from '../payment/payment.controller';
import { StudentController } from '../student/student.controller';

function methodMetadataTarget(target: object, name: string): object {
  const value: unknown = Object.getOwnPropertyDescriptor(target, name)?.value;
  if (typeof value !== 'function') {
    throw new Error(`Méthode introuvable : ${name}`);
  }
  return value;
}

describe('Ministry access policy', () => {
  it('réserve les parcours et opérations financières individuels aux étudiants', () => {
    const initiatePayment = methodMetadataTarget(
      PaymentController.prototype,
      'initiatePayment',
    );
    const getHistory = methodMetadataTarget(
      PaymentController.prototype,
      'getHistory',
    );
    const openBankAccount = methodMetadataTarget(
      PaymentController.prototype,
      'openBankAccount',
    );

    expect(Reflect.getMetadata(ROLES_KEY, StudentController)).toEqual([
      'STUDENT',
    ]);
    expect(Reflect.getMetadata(ROLES_KEY, initiatePayment)).toEqual([
      'STUDENT',
    ]);
    expect(Reflect.getMetadata(ROLES_KEY, getHistory)).toEqual(['STUDENT']);
    expect(Reflect.getMetadata(ROLES_KEY, openBankAccount)).toEqual([
      'STUDENT',
    ]);
  });

  it('réserve les journaux d’audit et les envois de notifications à l’administration', () => {
    const sendNotification = methodMetadataTarget(
      NotificationController.prototype,
      'sendNotification',
    );

    expect(Reflect.getMetadata(ROLES_KEY, AuditController)).toEqual([
      'ADMIN_GET',
    ]);
    expect(Reflect.getMetadata(ROLES_KEY, sendNotification)).toEqual([
      'ADMIN_GET',
    ]);
  });
});

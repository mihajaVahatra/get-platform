import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  const context = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({}) }),
  } as unknown as ExecutionContext;

  it('laisse une route explicitement publique contourner les rôles de classe', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValueOnce(true),
    };
    const guard = new RolesGuard(reflector as unknown as Reflector);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('refuse une requête sans utilisateur lorsqu’un rôle est requis', () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(['MINISTRY']),
    };
    const guard = new RolesGuard(reflector as unknown as Reflector);

    expect(guard.canActivate(context)).toBe(false);
  });
});

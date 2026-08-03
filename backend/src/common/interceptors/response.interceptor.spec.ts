import {
  type CallHandler,
  type ExecutionContext,
  StreamableFile,
} from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { ResponseInterceptor } from './response.interceptor';

describe('ResponseInterceptor', () => {
  const context = {
    switchToHttp: () => ({ getResponse: () => ({ statusCode: 200 }) }),
  } as unknown as ExecutionContext;

  const handlerFor = <T>(value: T) =>
    ({ handle: () => of(value) }) as unknown as CallHandler<T>;

  it('laisse passer un StreamableFile sans enveloppe JSON', async () => {
    const file = new StreamableFile(Buffer.from('rapport'));
    const interceptor = new ResponseInterceptor<StreamableFile>();

    const result = await firstValueFrom(
      interceptor.intercept(context, handlerFor(file)),
    );

    expect(result).toBe(file);
  });

  it('conserve l’enveloppe applicative déjà construite', async () => {
    const interceptor = new ResponseInterceptor<typeof payload>();
    const payload = { success: true, data: { total: 1 }, message: 'OK' };

    const result = await firstValueFrom(
      interceptor.intercept(context, handlerFor(payload)),
    );

    expect(result).toBe(payload);
  });
});

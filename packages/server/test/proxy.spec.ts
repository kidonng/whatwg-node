import { createServer } from 'http';
import { AddressInfo } from 'net';
import { fetch } from '@whatwg-node/fetch';
import { createServerAdapter } from '../src/createServerAdapter';
import { runTestsForEachFetchImpl } from './test-fetch';

describe('Proxy', () => {
  let aborted: boolean = false;
  const originalAdapter = createServerAdapter(async request => {
    if (request.url.endsWith('/delay')) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      aborted = request.signal.aborted;
    }
    return Response.json({
      method: request.method,
      url: request.url,
      headers: Object.fromEntries(request.headers.entries()),
      body: await request.text(),
    });
  });
  const originalServer = createServer(originalAdapter);
  const proxyAdapter = createServerAdapter(request => {
    const proxyUrl = new URL(request.url);
    return fetch(
      `http://localhost:${(originalServer.address() as AddressInfo).port}${proxyUrl.pathname}`,
      {
        method: request.method,
        headers: Object.fromEntries(
          [...request.headers.entries()].filter(([key]) => key !== 'host'),
        ),
        body: request.body,
        signal: request.signal,
      },
    );
  });
  const proxyServer = createServer(proxyAdapter);
  beforeAll(async () => {
    await new Promise<void>(resolve => originalServer.listen(0, resolve));
    await new Promise<void>(resolve => proxyServer.listen(0, resolve));
  });
  beforeEach(() => {
    aborted = false;
  });
  afterAll(async () => {
    await new Promise(resolve => originalServer.close(resolve));
    await new Promise(resolve => proxyServer.close(resolve));
  });
  runTestsForEachFetchImpl(() => {
    it('proxies requests', async () => {
      const response = await fetch(
        `http://localhost:${(proxyServer.address() as AddressInfo).port}/test`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            test: true,
          }),
        },
      );
      expect(await response.json()).toMatchObject({
        method: 'POST',
        url: `http://localhost:${(originalServer.address() as AddressInfo).port}/test`,
        headers: {
          'content-type': 'application/json',
          host: `localhost:${(originalServer.address() as AddressInfo).port}`,
        },
        body: JSON.stringify({
          test: true,
        }),
      });
      expect(response.status).toBe(200);
    });
    it('handles aborted requests', async () => {
      const response = fetch(
        `http://localhost:${(proxyServer.address() as AddressInfo).port}/delay`,
        {
          signal: AbortSignal.timeout(500),
        },
      );
      await expect(response).rejects.toThrow();
      await new Promise(resolve => setTimeout(resolve, 1000));
      expect(aborted).toBe(true);
    });
    it('handles requested terminated before abort', async () => {
      const res = await fetch(
        `http://localhost:${(proxyServer.address() as AddressInfo).port}/delay`,
        {
          signal: AbortSignal.timeout(2000),
        },
      );
      expect(res.ok).toBe(true);
      await res.text();
      await new Promise(resolve => setTimeout(resolve, 1000));
      expect(aborted).toBe(false);
    });
  });
});

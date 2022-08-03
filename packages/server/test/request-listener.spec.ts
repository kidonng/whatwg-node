import { createServerAdapter } from '@whatwg-node/server';
import { createServer, Server } from 'http';
import { Request, Response, ReadableStream, fetch } from '@whatwg-node/fetch';
import { Readable } from 'stream';

const methodsWithoutBody = ['GET', 'DELETE'];

const methodsWithBody = ['POST', 'PUT', 'PATCH'];

async function compareRequest(toBeChecked: Request, expected: Request) {
  expect(toBeChecked.method).toBe(expected.method);
  expect(toBeChecked.url).toBe(expected.url);
  expected.headers.forEach((value, key) => {
    const toBeCheckedValue = toBeChecked.headers.get(key);
    expect({
      key,
      value: toBeCheckedValue,
    }).toMatchObject({
      key,
      value,
    });
  });
}

async function compareStreams(toBeChecked: AsyncIterable<Uint8Array> | null, expected: BodyInit | null) {
  if (expected != null) {
    expect(toBeChecked).toBeTruthy();
    const expectedBody = new Response(expected).body;
    const expectedStream = Readable.from(expectedBody as any);
    const expectedIterator = expectedStream[Symbol.asyncIterator]();
    const toBeCheckedStream = Readable.from(toBeChecked as any);
    const toBeCheckedIterator = toBeCheckedStream[Symbol.asyncIterator]();
    const expectedValues: string[] = [];
    const toBeCheckedValues: string[] = [];
    while(true) {
      const [,done] = await Promise.all([
        toBeCheckedIterator.next().then(({ value }) => {
          if (value) {
            const str = Buffer.from(value).toString()
            const lines = str.split('\n')
            toBeCheckedValues.push(...lines);
          }
        }),
        expectedIterator.next().then(({ value, done }) => {
          if (value) {
            const str = Buffer.from(value).toString()
            const lines = str.split('\n')
            expectedValues.push(...lines);
          }
          if (done) {
            return true;
          }
        }),
      ])
      if (done) {
        break;
      }
    }
    expect(toBeCheckedValues).toEqual(expectedValues);
  }
}

async function compareResponse(toBeChecked: Response, expected: Response) {
  expect(toBeChecked.status).toBe(expected.status);
  expected.headers.forEach((value, key) => {
    const toBeCheckedValue = toBeChecked.headers.get(key);
    expect({
      key,
      value: toBeCheckedValue,
    }).toMatchObject({
      key,
      value,
    });
  });
}

let httpServer: Server;
async function runTestForRequestAndResponse({
  expectedRequest,
  expectedResponse,
  port,
  getRequestBody,
  getResponseBody,
}: {
  expectedRequest: Request;
  expectedResponse: Response;
  port: number;
  getRequestBody: () => BodyInit;
  getResponseBody: () => BodyInit;
}) {
  const app = createServerAdapter({
    async handleRequest(request: Request) {
      await compareRequest(request, expectedRequest);
      if (methodsWithBody.includes(expectedRequest.method)) {
        await compareStreams(request.body as any, getRequestBody());
      }
      return expectedResponse;
    },
  });
  httpServer = createServer(app);
  await new Promise<void>(resolve => httpServer.listen(port, '127.0.0.1', resolve));
  const returnedResponse = await fetch(expectedRequest);
  await compareResponse(returnedResponse, expectedResponse);
  await compareStreams(returnedResponse.body as any, getResponseBody());
}

function getRegularRequestBody() {
  return JSON.stringify({ requestFoo: 'requestFoo' });
}

function getRegularResponseBody() {
  return JSON.stringify({ responseFoo: 'responseFoo' });
}

async function* getIncrementalRequestBody() {
  for (let i = 0; i < 2; i++) {
    await new Promise(resolve => setTimeout(resolve, 30));
    yield `data: request_${i.toString()}\n`;
  }
}

async function* getIncrementalResponseBody() {
  for (let i = 0; i < 10; i++) {
    await new Promise(resolve => setTimeout(resolve, 30));
    yield `data: response_${i.toString()}\n`;
  }
}

describe('Request Listener', () => {
  let port = 9876;
  afterEach(done => {
    if (httpServer) {
      httpServer.close(done);
    } else {
      done();
    }
    port = Math.floor(Math.random() * 1000) + 9800;
  });
  [...methodsWithBody, ...methodsWithoutBody].forEach(method => {
    it(`should handle regular requests with ${method}`, async () => {
      const requestInit: RequestInit = {
        method,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'random-header': Date.now().toString(),
        },
      };
      if (methodsWithBody.includes(method)) {
        requestInit.body = getRegularRequestBody();
      }
      const expectedRequest = new Request(`http://127.0.0.1:${port}`, requestInit);
      const expectedResponse = new Response(getRegularResponseBody(), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'random-header': Date.now().toString(),
        },
      });
      await runTestForRequestAndResponse({
        expectedRequest,
        getRequestBody: getRegularRequestBody,
        expectedResponse,
        getResponseBody: getRegularResponseBody,
        port,
      });
    });
    it(`should handle incremental responses with ${method}`, async () => {
      const requestInit: RequestInit = {
        method,
        headers: {
          accept: 'application/json',
          'random-header': Date.now().toString(),
        },
      };
      if (methodsWithBody.includes(method)) {
        requestInit.body = getRegularRequestBody();
      }
      const expectedRequest = new Request(`http://127.0.0.1:${port}`, requestInit);
      const expectedResponse = new Response(getIncrementalResponseBody() as any, {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'random-header': Date.now().toString(),
        },
      });
      await runTestForRequestAndResponse({
        expectedRequest,
        getRequestBody: getRegularRequestBody,
        expectedResponse,
        getResponseBody: getIncrementalResponseBody as any,
        port,
      });
    });
  });
  methodsWithBody.forEach(method => {
    it(`should handle incremental requests with ${method}`, async () => {
      const requestInit: RequestInit = {
        method,
        headers: {
          accept: 'application/json',
          'random-header': Date.now().toString(),
        },
      };
      if (methodsWithBody.includes(method)) {
        requestInit.body = getIncrementalRequestBody() as any;
      }
      const expectedRequest = new Request(`http://127.0.0.1:${port}`, requestInit);
      const expectedResponse = new Response(getRegularResponseBody(), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'random-header': Date.now().toString(),
        },
      });
      await runTestForRequestAndResponse({
        expectedRequest,
        getRequestBody: getIncrementalRequestBody as any,
        expectedResponse,
        getResponseBody: getRegularResponseBody,
        port,
      });
    });
  });
});

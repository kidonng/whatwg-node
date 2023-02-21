import { Readable, Duplex } from 'stream';
import { HTTPParser, methods } from '_http_common';
import { Request, ReadableStream } from '@whatwg-node/fetch';

function getRequest(readable: Readable): Promise<Request> {
    return new Promise(resolve => {
        try {
            const parser = new HTTPParser();
            parser.initialize(HTTPParser.REQUEST, {});
            parser[HTTPParser.kOnHeadersComplete] = (versionMajor: number, versionMinor: number, headers: string[], methodIndex: number, url: string, statusCode: number, statusMessage: string, upgrade: boolean, shouldKeepAlive: boolean) => {
                const headersObj = {};
                for (let i = 0; i < headers.length; i += 2) {
                    headersObj[headers[i]] = headers[i + 1];
                }
                const body = new Readable();
                parser[HTTPParser.kOnBody] = (chunk: Buffer) => {
                    body.push(chunk);
                };
                readable.on('end', () => {
                    body.push(null);
                });
                resolve(
                    new Request(new URL(url, 'http://localhost'), {
                        method: methods[methodIndex],
                        headers: headersObj,
                        body: body as unknown as ReadableStream<Uint8Array>,
                    })
                )
            }
            readable.on('data', (chunk: Buffer) => {
                parser.execute(chunk, 0, chunk.length);
            });
        } catch (e) {
            console.error(e);
        }
    })
}

describe('Test', () => {

    it('test', )

    it('test', async () => {
        const buf = Buffer.from(
            'POST /it HTTP/1.1\r\n' +
            'Content-Type: text/plain\r\n' +
            'Transfer-Encoding: chunked\r\n' +
            '\r\n' +
            '3\r\n' +
            '123\r\n' +
            '6\r\n' +
            '123456\r\n'
        );
        const readable = Readable.from(buf);
        const request = await getRequest(readable);
        console.log({
            method: request.method,
            url: request.url,
            headers: request.headers,
            body: await request.text(),
        })
    })
})
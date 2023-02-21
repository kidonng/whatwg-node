import { createServer, Server, Socket } from 'net';
import { Readable } from 'stream';
import { FetchEvent } from '@whatwg-node/server';
import { HTTPParser, methods } from '_http_common';
import { Request } from '@whatwg-node/node-fetch';

type FetchEventListener = (event: FetchEvent) => void;
type FetchEventListenerObject = {
    handleEvent: FetchEventListener;
};

export interface NodeFetchServer extends Server {
    addEventListener(event: 'fetch', listener: FetchEventListener | FetchEventListenerObject): void;
    removeEventListener(event: 'fetch', listener: FetchEventListener | FetchEventListenerObject): void;
}

// According to the specs, HTTP 1.1 uses CRLF for line breaks
// https://www.rfc-editor.org/rfc/rfc2616
const CRLF = '\r\n';

interface NodeFetchEventOptions {
    versionMajor: number;
    versionMinor: number;
    url: string;
    headers: string[];
    methodIndex: number;
    socket: Socket;
    parser: HTTPParser;
}

class NodeFetchEvent extends Event implements FetchEvent {
    public request: Request;
    private versionMajor: number;
    private versionMinor: number;
    private socket: Socket;
    constructor({
        versionMajor,
        versionMinor,
        url,
        headers,
        methodIndex,
        parser,
        socket,
    }: NodeFetchEventOptions) {
        super('fetch');
        this.versionMajor = versionMajor;
        this.versionMinor = versionMinor;
        this.socket = socket;
        const body = new Readable();
        parser[HTTPParser.kOnBody] = (chunk: Buffer) => {
            body.push(chunk);
        };
        socket.once('end', () => {
            body.push(null);
        });
        const headersObj = {};
        for (let i = 0; i < headers.length; i += 2) {
            headersObj[headers[i]] = headers[i + 1];
        }
        this.request = new Request(new URL(url, 'http://localhost'), {
            method: methods[methodIndex],
            headers: headersObj,
            body,
        });
    }

    waitUntil(_promise: void | Promise<void>): void {
        // TODO: Implement
    }

    respondWith(response: Response) {
        this.socket.write(
            `HTTP/${this.versionMajor}.${this.versionMinor} ${response.status} ${response.statusText}${CRLF}`,
        );
        response.headers.forEach((value, key) => {
            this.socket.write(`${key}: ${value}${CRLF}`);
        });
        this.socket.write(CRLF);
        if (response.body === null) {
            this.socket.end();
            return;
        }
        (response.body as any).pipe(this.socket);
    }
}

export function createFetchServer(): NodeFetchServer {
    const server = createServer();
    server.on('connection', socket => {
        const parser = new HTTPParser();
        parser.initialize(HTTPParser.REQUEST, {});
        parser[HTTPParser.kOnHeadersComplete] = (
            versionMajor: number,
            versionMinor: number,
            headers: string[],
            methodIndex: number,
            url: string,
            _statusCode: number,
            _statusMessage: string,
            _upgrade: boolean,
            _shouldKeepAlive: boolean,
        ) => {
            const event = new NodeFetchEvent({
                versionMajor,
                versionMinor,
                socket,
                url,
                headers,
                methodIndex,
                parser,
            });
            server.emit('fetch', event);
        };
        socket.on('data', (chunk: Buffer) => {
            parser.execute(chunk, 0, chunk.length);
        });
    });
    const nodeFetchServer = server as NodeFetchServer;
    nodeFetchServer.addEventListener = function (event, listenerObjOrFn) {
        let listenerFn: FetchEventListener;
        if (typeof listenerObjOrFn === 'function') {
            listenerFn = listenerObjOrFn;
        } else {
            listenerFn = listenerObjOrFn.handleEvent;
        }
        this.addListener(event, listenerFn);
    }
    nodeFetchServer.removeEventListener = function (event, listenerObjOrFn) {
        let listenerFn: FetchEventListener;
        if (typeof listenerObjOrFn === 'function') {
            listenerFn = listenerObjOrFn;
        } else {
            listenerFn = listenerObjOrFn.handleEvent;
        }
        this.removeListener(event, listenerFn);
    }
    return server as NodeFetchServer;
}

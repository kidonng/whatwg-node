import { createFetchServer, NodeFetchServer } from "../src";
import { Response,fetch } from "@whatwg-node/node-fetch";

describe('Node Fetch Server', () => {
    let server: NodeFetchServer;
    afterEach(done => {
        if (server) {
            server.close(done);
        } else {
            done();
        }
    })
    it('should work', async () => {
        server = createFetchServer();
        server.addEventListener('fetch', async event => {
            event.respondWith(new Response('Hello World'));
        });
        server.listen(8080);
        const response = await fetch('http://localhost:8080');
        expect(await response.text()).toBe('Hello World');
    });
})
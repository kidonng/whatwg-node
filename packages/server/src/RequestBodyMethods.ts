import { TextEncoder, Blob, Request } from "@whatwg-node/fetch";

export type RequestBodyMethods = Pick<Request, 'arrayBuffer' | 'blob' | 'formData' | 'json' | 'text'> & { body: AsyncIterable<Uint8Array> };

export function RequestBodyMethodsFromString(str: string): RequestBodyMethods {
    const textEncoder = new TextEncoder();
    return {
        async arrayBuffer() {
            return textEncoder.encode(str).buffer;
        },
        async blob() {
            return new Blob([str]);
        },
        get body() {
            async function *createAsyncIterable() {
                yield textEncoder.encode(str);
            }
            return createAsyncIterable();
        },
        async formData() {
            throw new Error('Not implemented');
        },
        async json() {
            return JSON.parse(str);
        },
        async text() {
            return str;
        }
    }
}

export function RequestBodyMethodsFromUint8Array(uint8Array: Uint8Array): RequestBodyMethods {
    return {
        async arrayBuffer() {
            return uint8Array.buffer;
        },
        async blob() {
            return new Blob([uint8Array]);
        },
        get body() {
            async function *createAsyncIterable() {
                yield uint8Array;
            }
            return createAsyncIterable();
        },
        async formData() {
            throw new Error('Not implemented');
        },
        async json() {
            return JSON.parse(new TextDecoder().decode(uint8Array));
        },
        async text() {
            return new TextDecoder().decode(uint8Array);
        },
    }
}

export function RequestBodyMethodsFromBlob(blob: Blob): RequestBodyMethods {
    return {
        arrayBuffer() {
            return blob.arrayBuffer();
        },
        async blob() {
            return blob;
        },
        get body(): any {
            return blob.stream();
        },
        async formData() {
            throw new Error('Not implemented');
        },
        async json() {
            const text = await blob.text();
            return JSON.parse(text);
        },
        text() {
            return blob.text();
        }
    }
}

export function RequestBodyMethodsFromFormData(formData: FormData): RequestBodyMethods {
    return {
        arrayBuffer() {
            throw new Error('Not implemented');
        },
        async blob() {
            throw new Error('Not implemented');
        },
        get body(): any {
            throw new Error('Not implemented');
        },
        async formData() {
            return formData;
        },
        async json() {
            throw new Error('Not implemented');
        },
        text() {
            throw new Error('Not implemented');
        }
    }
}

export function RequestBodyMethodsFromAsyncIterable(asyncIterable: AsyncIterable<Uint8Array>): RequestBodyMethods {
    const textDecoder = new TextDecoder();
    return {
        async arrayBuffer() {
            const chunks = [];
            for await (const chunk of asyncIterable) {
                chunks.push(...chunk);
            }
            return new Uint8Array(chunks).buffer;
        },
        async blob() {
            const chunks = [];
            for await (const chunk of asyncIterable) {
                chunks.push(chunk);
            }
            return new Blob(chunks);
        },
        get body() {
            return asyncIterable;
        },
        async formData() {
            return Request.prototype.formData.apply(this);
        },
        async json() {
            const text = await this.text();
            return JSON.parse(text);
        },
        async text() {
            let text = '';
            for await (const chunk of asyncIterable) {
                text += textDecoder.decode(chunk);
            }
            return text;
        }
    }
}

export function RequestBodyMethodsFromJson(jsonData: any): RequestBodyMethods {
    const encoder = new TextEncoder();
    return {
        async arrayBuffer() {
            return encoder.encode(await this.text()).buffer;
        },
        async blob() {
            return new Blob([await this.text()]);
        },
        get body() {
            async function* createAsyncIterable() {
                yield encoder.encode(JSON.stringify(jsonData));
            }
            return createAsyncIterable();
        },
        async formData() {
            throw new Error('Not implemented');
        },
        async json() {
            return jsonData;
        },
        async text() {
            return JSON.stringify(jsonData);
        },
    }
}

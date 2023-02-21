declare module '_http_common' {
    export const methods: string[];
    export class HTTPParser {
        static kOnBody: number;
        static kOnHeadersComplete: number;
        static REQUEST: number;
        static RESPONSE: number;
        initialize(type: number, options: any): void;
        execute(chunk: Buffer, start: number, length: number): number;
    }
}
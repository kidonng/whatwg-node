export function getHeadersFromObj(headersObj: Record<string, string>): Headers {
    return {
        get(name: string): string | null {
            return headersObj[name.toLowerCase()] || null;
        },
        has(name: string): boolean {
            return name.toLowerCase() in headersObj;
        },
        set(name: string, value: string): void {
            headersObj[name.toLowerCase()] = value;
        },
        append(name: string, value: string): void {
            headersObj[name.toLowerCase()] = (headersObj[name.toLowerCase()] || '') + value;
        },
        delete(name: string): void {
            delete headersObj[name.toLowerCase()];
        },
        forEach(callback: (value: string, name: string, headers: Headers) => void): void {
            for (const name in headersObj) {
                callback(headersObj[name], name, this);
            }
        }
    }
}
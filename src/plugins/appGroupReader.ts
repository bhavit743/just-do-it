import { registerPlugin } from '@capacitor/core';

export interface AppGroupReaderPlugin {
  list(): Promise<{ files: string[] }>;
  read(options: { name: string }): Promise<{ data: string; name: string }>;
  remove(options: { name: string }): Promise<void>;
}

// Provide a no-op web shim so your code won’t crash on web
export const AppGroupReader = registerPlugin<AppGroupReaderPlugin>('AppGroupReader', {
  web: () => ({
    async list() { return { files: [] }; },
    async read() { throw new Error('AppGroupReader not available on web'); },
    async remove() { /* no-op */ },
  }),
});

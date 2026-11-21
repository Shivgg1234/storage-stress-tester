import type { StorageOptions } from './index.js';
export type ScriptPayload = Required<StorageOptions> & { origin: string; area: 'localStorage' | 'sessionStorage'; denyAccess: boolean };
export interface InitScriptContext { addInitScript(script: (arg: ScriptPayload) => void, arg: ScriptPayload): Promise<unknown> }
export interface BrowserOptions extends StorageOptions { origin: string; area?: 'localStorage' | 'sessionStorage'; denyAccess?: boolean }
export function installStorageFaults(context: InitScriptContext, options: BrowserOptions): Promise<void>;

export type Operation = 'getItem' | 'setItem' | 'removeItem' | 'clear' | 'key' | 'length';
export interface Fault { operation: Operation; error: 'QuotaExceededError' | 'SecurityError' | 'UnknownError'; key?: string; at?: number; times?: number }
export interface StorageOptions { initial?: Record<string, string>; faults?: Fault[] }
export interface StorageLike { readonly length: number; key(index: number): string | null; getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void; clear(): void }
export interface OperationRecord { operation: Operation; key?: string; value?: string; outcome: 'ok' | 'error'; error?: string }
export interface FaultyStorage extends StorageLike { snapshot(): Record<string, string>; operations(): OperationRecord[]; reset(): void }
export interface Scenario extends StorageOptions { name: string }
export interface Report { passed: boolean; total: number; failed: number; results: { name: string; passed: boolean; error?: { name: string; message: string } }[] }
export function validateOptions(options?: StorageOptions): Required<StorageOptions>;
export function createFaultyStorage(options?: StorageOptions): FaultyStorage;
export function storageScenarios(key: string, options?: { oldValue?: unknown; wrongShape?: unknown }): Scenario[];
export function runScenarios(scenarios: Scenario[], run: (storage: FaultyStorage, scenario: Scenario) => unknown | Promise<unknown>): Promise<Report>;
export function formatReport(report: Report): string;
/** Fixtures and migration outputs must be structured-cloneable JSON-like data. */
export function checkMigration<T>(options: { fixtures: { name: string; value: T }[]; migrate: (value: T) => T | Promise<T>; validate: (value: T) => boolean | Promise<boolean>; preserve?: (value: T) => unknown | Promise<unknown> }): Promise<Report>;

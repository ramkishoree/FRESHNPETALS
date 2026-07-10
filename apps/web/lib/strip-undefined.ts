/**
 * Zod's `.optional()` produces `{ key: T | undefined }` (the key is always
 * present, its value may be `undefined`); this project's domain types use
 * `{ key?: T }` under `exactOptionalPropertyTypes`, where an explicit
 * `undefined` value is a type error even on an optional key. Parsed
 * request bodies need this conversion before reaching a domain/
 * application-layer function — the mapped return type below actually
 * drops `| undefined` from each optional value's type (not just from the
 * runtime object), which a same-shape identity mapping wouldn't do.
 */
type StripUndefined<T> = {
  [K in keyof T as undefined extends T[K] ? K : never]?: Exclude<T[K], undefined>;
} & {
  [K in keyof T as undefined extends T[K] ? never : K]: T[K];
};

export function stripUndefined<T extends object>(input: T): StripUndefined<T> {
  const result = {} as T;
  for (const key of Object.keys(input) as (keyof T)[]) {
    if (input[key] !== undefined) result[key] = input[key];
  }
  return result as StripUndefined<T>;
}

export type RequiredExcept<T, K extends keyof T> = Required<Omit<T, K>> & Partial<Pick<T, K>>;

export type RequiredOnly<T, K extends keyof T> = Partial<Omit<T, K>> & Required<Pick<T, K>>;

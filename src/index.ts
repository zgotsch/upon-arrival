export class ArrivalError extends Error {
  errors?: Array<Error>;
  cause?: unknown;
  constructor(
    message: string,
    options?: {errors?: Array<Error>; cause?: unknown}
  ) {
    // @ts-ignore
    super(message, {cause: options.cause});
    this.errors = options?.errors;
    this.cause = options?.cause;
    this.name = "ArrivalError";

    if (this.errors != null) {
      this.message = [
        this.message,
        ...this.errors.map((error: Error) => error.message),
      ].join("\n");
    }
    this.message = this.message;
  }
}

export const PROMISE: unique symbol = Symbol("PROMISE");

export type Arrival<T> = {
  [K in keyof T as T[K] extends (...args: infer A) => void
    ? K
    : never]: T[K] extends (...args: infer A) => void
    ? (...args: A) => void
    : never;
} & {[PROMISE]: Promise<T>};

const UNRESOLVED: unique symbol = Symbol();

export default function uponArrival<T extends Record<PropertyKey, unknown>>(
  promise: Promise<T>
): Arrival<T> {
  if (typeof promise.then !== "function") {
    throw new TypeError("Expected a promise");
  }

  let resolved: typeof UNRESOLVED | T = UNRESOLVED;
  const queue: Array<Invocation> = [];

  function drain() {
    if (resolved === UNRESOLVED) {
      throw new ArrivalError("Cannot drain when the promise is not resolved");
    }

    const errors: Array<Error> = [];
    while (queue.length > 0) {
      const invocation = queue.shift()!;
      try {
        const target: (...args: any) => void = resolved[invocation.key] as any;
        if (target === undefined) {
          throw new Error(`No such method ${String(invocation.key)}`);
        }
        target.apply(null, invocation.args);
      } catch (e) {
        console.error("Rejected method invocation during drain", invocation, e);

        if (e instanceof Error) {
          errors.push(e);
        } else {
          errors.push(new Error((e as any).toString()));
        }
      }
    }

    if (errors.length > 0) {
      throw new ArrivalError(
        `Rejected method invocation${
          errors.length > 1 ? "s" : ""
        } during drain`,
        {
          errors,
        }
      );
    }
  }

  const wrapped = promise
    .then(
      (resolvedValue) => {
        resolved = resolvedValue;
        drain();
        return resolvedValue;
      },
      (error) => {
        console.error("Inner promise rejected", error);
        // @ts-ignore
        throw new ArrivalError("Inner promise rejected", {cause: error});
      }
    )
    // Wrap all errors as ArrivalErrors
    .catch((e) => {
      let arrivalError: ArrivalError;
      if (e instanceof ArrivalError) {
        arrivalError = e;
      } else {
        // @ts-ignore
        arrivalError = new ArrivalError("Unknown error", {cause: e});
      }
      throw arrivalError;
    });

  const arrival = new Proxy(promise as any as Arrival<T>, {
    get(target, key) {
      if (key === PROMISE) {
        return wrapped;
      }
      if (resolved !== UNRESOLVED) {
        return resolved[key];
      }
      return (...args: Array<unknown>) => {
        queue.push({key, args, stack: stackTrace(2)});
      };
    },
  });

  return arrival;
}

type Invocation = {
  key: PropertyKey;
  args: Array<unknown>;
  stack: undefined | string;
};

function stackTrace(framesToPop = 0): undefined | string {
  const error = new Error();

  return error.stack
    ?.split("\n")
    .slice(framesToPop + 1)
    .join("\n");
}

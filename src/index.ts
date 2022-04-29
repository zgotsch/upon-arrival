export class ArrivalError extends Error {}

type Arrival<T> = {
  [K in keyof T as T[K] extends (...args: infer A) => void
    ? K
    : never]: T[K] extends (...args: infer A) => void
    ? (...args: A) => void
    : never;
};

const UNRESOLVED: unique symbol = Symbol();

export default function arrival<T extends Record<PropertyKey, unknown>>(
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
    while (queue.length > 0) {
      const invocation = queue.shift()!;
      try {
        (resolved[invocation.key] as (...args: any) => void).apply(
          null,
          invocation.args
        );
      } catch (e) {
        console.error("Rejected method invocation during drain", invocation, e);
      }
    }
  }

  promise
    .then(
      (resolvedValue) => {
        resolved = resolvedValue;
        drain();
      },
      (error) => {
        console.error("Inner promise rejected", error);
        // @ts-ignore
        throw new ArrivalError("Inner promise rejected", {cause: error});
      }
    )
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

  return new Proxy(promise as any as Arrival<T>, {
    get(target, key) {
      if (resolved !== UNRESOLVED) {
        return resolved[key];
      }
      return (...args: Array<unknown>) => {
        queue.push({key, args});
      };
    },
  });
}

type Invocation = {
  key: PropertyKey;
  args: Array<unknown>;
};

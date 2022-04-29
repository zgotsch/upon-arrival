import uponArrival, {ArrivalError} from "./index";

function flushPromises() {
  return new Promise((resolve) => setImmediate(resolve));
}

// https://stackoverflow.com/questions/53807517/how-to-test-if-two-types-are-exactly-the-same
type IfEquals<T, U, Y = unknown, N = never> = (<G>() => G extends T
  ? 1
  : 2) extends <G>() => G extends U ? 1 : 2
  ? Y
  : N;

declare const exactType: <T, U>(
  draft: T & IfEquals<T, U>,
  expected: U & IfEquals<T, U>
) => IfEquals<T, U>;

declare let a: any[];
declare let b: [number][];

describe("uponArrival", () => {
  it("will not wrap a non-promise", () => {
    // @ts-expect-error
    expect(() => uponArrival()).toThrow(TypeError);
    // @ts-expect-error
    expect(() => uponArrival(null)).toThrow(TypeError);
    // @ts-expect-error
    expect(() => uponArrival(42)).toThrow(TypeError);
    // @ts-expect-error
    expect(() => uponArrival("hello")).toThrow(TypeError);
    // @ts-expect-error
    expect(() => uponArrival({})).toThrow(TypeError);
  });

  it("will raise a type error when wrapping a promise which is not an object", () => {
    // @ts-expect-error
    expect(() => uponArrival(Promise.resolve(undefined))).not.toThrow();
    // @ts-expect-error
    expect(() => uponArrival(Promise.resolve(null))).not.toThrow();
    // @ts-expect-error
    expect(() => uponArrival(Promise.resolve(42))).not.toThrow();
    // @ts-expect-error
    expect(() => uponArrival(Promise.resolve("hello"))).not.toThrow();
  });

  it("wraps a promise of an empty object", () => {
    uponArrival(Promise.resolve({}));
  });

  it("allows calls to functions on an arrival", () => {
    const inner = {
      foo() {},
      bar(x: number) {
        return x + 42;
      },
    };

    const arrival = uponArrival(Promise.resolve(inner));
    expect(arrival.foo()).toBe(undefined);
    // @ts-expect-error
    expect(arrival.bar()).toBe(undefined);
    expect(arrival.bar(7)).toBe(undefined);
    // @ts-expect-error
    expect(arrival.unknownMethod()).toBe(undefined);
  });

  it("converts non-void functions to void functions", () => {
    const inner = {
      foo() {},
      bar(x: number) {
        return x + 42;
      },
    };

    const arrival = uponArrival(Promise.resolve(inner));
    () => {
      exactType(arrival.foo, () => {});
    };
    () => {
      // @ts-expect-error
      exactType(arrival.bar, inner.bar);
    };
    () => {
      exactType(arrival.bar, (x: number) => {});
    };
  });

  it("drops non-function properties from the type", () => {
    const inner = {
      foo: "hello",
      bar: 42,
      baz: () => {},
    };

    const arrival = uponArrival(Promise.resolve(inner));
    // @ts-expect-error
    arrival.foo;
    // @ts-expect-error
    arrival.bar;
    expect(arrival.baz).not.toBe(undefined);
  });

  it("calls functions immediately if the promise is resolved", async () => {
    const foo = jest.fn();
    const bar = jest.fn();
    const baz = jest.fn();
    const arrival = uponArrival(
      Promise.resolve({
        foo,
        bar,
        baz,
      })
    );

    await flushPromises();

    arrival.foo(0);
    arrival.bar("hello", "there");
    arrival.foo(1);
    arrival.baz();
    arrival.foo(2);

    expect(foo).toHaveBeenCalledTimes(3);
    expect(foo.mock.calls).toEqual([[0], [1], [2]]);
    expect(bar).toHaveBeenCalledTimes(1);
    expect(bar).toHaveBeenLastCalledWith("hello", "there");
    expect(baz).toHaveBeenCalledTimes(1);
  });

  it("calls functions in order when the promise resolves", async () => {
    const foo = jest.fn();
    const bar = jest.fn();
    const baz = jest.fn();

    let resolve;
    const p = new Promise((resolve, reject) => {
      resolve = resolve;
    });

    const arrival = uponArrival(
      Promise.resolve({
        foo,
        bar,
        baz,
      })
    );

    arrival.foo(0);
    arrival.bar("hello", "there");
    arrival.foo(1);
    arrival.baz();
    arrival.foo(2);

    expect(foo).toHaveBeenCalledTimes(0);
    expect(bar).toHaveBeenCalledTimes(0);
    expect(baz).toHaveBeenCalledTimes(0);

    (resolve as any)?.();
    await flushPromises();

    expect(foo).toHaveBeenCalledTimes(3);
    expect(foo.mock.calls).toEqual([[0], [1], [2]]);
    expect(bar).toHaveBeenCalledTimes(1);
    expect(bar).toHaveBeenLastCalledWith("hello", "there");
    expect(baz).toHaveBeenCalledTimes(1);
  });

  it("rejects unhandled if the inner promise is rejected", async () => {
    // @ts-ignore
    const actualProcess = process.actual();
    const oldListeners = actualProcess.listeners("unhandledRejection");
    actualProcess.removeAllListeners("unhandledRejection");

    const unhandledRejectionHandler = jest.fn();
    actualProcess.once("unhandledRejection", unhandledRejectionHandler);

    const error = new Error("hello");
    uponArrival(Promise.reject(error));

    await flushPromises();

    expect(unhandledRejectionHandler).toHaveBeenCalledTimes(1);
    expect(unhandledRejectionHandler.mock.calls[0][0]).toBeInstanceOf(
      ArrivalError
    );
    expect(unhandledRejectionHandler.mock.calls[0][0].message).toBe(
      "Inner promise rejected"
    );

    for (const listener of oldListeners) {
      actualProcess.on("unhandledRejection", listener);
    }
  });
});

import uponArrival, {ArrivalError, PROMISE} from "./index";

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

    // it makes all returns undefined
    const arrival = uponArrival(Promise.resolve(inner));
    expect(arrival.foo()).toBe(undefined);
    // @ts-expect-error
    expect(arrival.bar()).toBe(undefined);
    expect(arrival.bar(7)).toBe(undefined);
    // @ts-expect-error
    arrival.unknownMethod;
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

  describe("catching errors", () => {
    it("exposes a promise with the PROMISE export", () => {
      const arrival = uponArrival(Promise.resolve({}));
      expect(arrival[PROMISE]).toBeInstanceOf(Promise);
    });

    it("will reject if the inner promise is rejected", async () => {
      const arrival = uponArrival(Promise.reject(new Error("hello")));
      try {
        await arrival[PROMISE];
        expect("should have thrown").toBe(false);
      } catch (e: any) {
        expect(e).toBeInstanceOf(ArrivalError);
        expect(e.message).toBe("Inner promise rejected");
        // inner rejected value is available as cause
        expect(e.cause).toBeInstanceOf(Error);
        expect(e.cause.message).toBe("hello");
      }
    });

    it("will reject if any of the method invocations throws during drain", async () => {
      const foo = jest.fn(() => {
        throw new Error("inner error");
      });

      const arrival = uponArrival(Promise.resolve({foo}));
      arrival.foo();
      // @ts-expect-error
      arrival.unknownMethod();

      try {
        await arrival[PROMISE];
        expect("should have thrown").toBe(false);
      } catch (e: any) {
        expect(e).toBeInstanceOf(ArrivalError);
        expect(e.message).toMatch("Rejected method invocations during drain");
        expect(e.errors).toMatchInlineSnapshot(`
Array [
  [Error: inner error],
  [Error: No such method unknownMethod],
]
`);
      }
    });
  });
});

# upon-arrival

**upon-arrival** is a library that allows promised objects to be treated as if they were available synchronously for the purposes of calling their methods. This is very useful for libraries which may be lazy loaded, and have some side-effect that can occur sometime in the future, such as metrics gathering libraries noting that an event occurred.

The object returned by `uponArrival`, the default export of this library, is an ES6 proxy. While the promise is not yet resolved, calls to functions on the target object are placed in a queue, which are then resolved in order when the target promise resolves. After the promise has resolved, calls to functions on the target object will be synchronous.

### A simple example
```typescript
import uponArrival from 'upon-arrival';

const myCallableObject = {
   foo() {
      return 'bar';
   }

   doBar() {
      // ...
   }
};

async function getCallable() {
   await new Promise(resolve => setTimeout(resolve, 1000));
   return myCallableObject;
}

const arrival = uponArrival(getCallable());

// I can call arrival.doBar(), even though the promise isn't resolved yet
arrival.doBar();

// I can call foo(), but it won't necessarily return anything, so typescript will complain if I
// try to use that value
// @ts-expect-error
const foo: string = arrival.foo();

// When the promise resolves, all of the called methods will execute in order
```

## Errors
**upon-arrival** exposes a promise that rejects when an error occurs. The type of the error is always `ArrivalError`. Any causative error will appear in the `cause` property of the error. If an error occurs as the promise is resolving, an error will be printed to the console with a stack trace.

### An example with an error
```typescript
import uponArrival, {PROMISE} from 'upon-arrival';

const arrival = uponArrival(myPromise);
const promise = arrival[PROMISE];

promise.catch(err => console.error(err.message));

// I can cause an error by calling a method that throws
arrival.methodThatThrows();

// I can also cause an error by calling a method that doesn't exist, but Typescript will prevent
// this if it knows the method doesn't exist
// @ts-expect-error
arrival.methodThatDoesNotExist();

// when the promise resolves, both of these errors will be returned in the `errors` property of a
// single `ArrivalError`
```

## API

- `function uponArrival<T extends Record<PropertyKey, unknown>>(promise: Promise<T>): Arrival<T>` (default export): Create an `Arrival` object from a promise. An arrival object has all the same methods as the object returned by the promise, but they are all `void`, since they cannot return anything if the promise hasn't been resolved yet. TODO: actually no reason to not return a promise that resolves with the value, once the inner promise is resolved.
- `PROMISE`: A symbol that can be used to access the promise for error-handling.
- `ArrivalError`: a subclass of `Error` that is thrown when an error occurs while resolving the promise. It may have a `cause` or `errors` property which reference the cause of the error.

## Further reading
- [What Color is Your Function](https://journal.stuffwithstuff.com/2015/02/01/what-color-is-your-function/) by Bob Nystrom
- [Promises/A+ Spec](https://promisesaplus.com/)

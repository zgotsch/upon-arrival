# upon-arrival

**upon-arrival** is a library that allows promised objects to be treated as if they were synchronous. Using ES6 proxies, calls to functions on the target object are placed in a queue, which are then resolved in order when the target promise resolves.

## Errors
If there is an error while calling the funcitons after the promise has resolved, an error will be printed to the console, but no promise rejection will be

## Further reading
[What Color is Your Function](https://journal.stuffwithstuff.com/2015/02/01/what-color-is-your-function/) by Bob Nystrom

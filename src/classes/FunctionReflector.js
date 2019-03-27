const functionReflector = require('js-function-reflector');

/**
 * Wrapper class around the js-function-reflector library.
 *
 * @property {number} hashSeed Seed for murmur hashing, positive integer.
 * @property {Map.<number, Object.<String, *>>} functionMap Maps hashes to
 *  parsed functions, this acts as a cache to avoid parsing the same functions
 *  over and over.
 *
 * @class FunctionReflector
 *
 * @see https://github.com/arrizalamin/js-function-reflector
 */
class FunctionReflector {
  constructor(hashSeed) {
    this._class = `FunctionReflector`;
    this.hashSeed = hashSeed;
    this.functionMap = new Map();
  }

  /**
   * Returns the result of parsing the given function.
   *
   * @function FunctionReflector#forFunction
   * @param {(Function|string)} func Function to be parsed.
   * @param {Object.<String, *>} [scope] A scope in which to parse the function.
   *  Currently not fully supported, since the parsed result is stored using the
   *  hash of the function regardless of the scope -- it works if you make sure
   *  to pass the correct scope the first time and if the scope never changes.
   * @returns {Object.<String, *>} The parsed function, see the
   *  js-function-reflector documentation for more information on the structure
   *  of this object.
   */
  forFunction(func, scope) {
    const hash = murmurhash3_32_gc(
        typeof func === `function` ? func.toString() : func, this.hashSeed);

    if (!this.functionMap.has(hash)) {
      this.functionMap.set(hash, functionReflector(func, scope));
    }

    return this.functionMap.get(hash);
  }

  /**
   * Returns the 0-based position of the last argument of the given function, if
   * the argument is destructuring and there is no value for the argument in the
   * given `args` array.
   *
   * This is used to dynamically check if a function (e.g., event handler)
   * expects a destructuring argument to be injected (e.g., metadata).
   *
   * Note that you may have to fill the args array with `undefined` entries up
   * to the injection point.
   *
   * @function FunctionReflector#getArgumentInjectionPosition
   * @param {(Function|string)} func The function to be inspected.
   * @param {Array} args Arguments to the function, used to determine if there
   *  are arguments missing (i.e. if the function expects more parameters than
   *  were given).
   * @returns {number} 0-based position of the last argument if the function
   *  seems to expect argument injection, or -1 otherwise.
   */
  getArgumentInjectionPosition(func, args) {
    const params = this.forFunction(func).params;
    const numParams = params.length;

    // It's enough to check if it's destructuring, since a bug in the library
    // does not detect destructuring parameters with default parameters as
    // destructuring, but as normal parameters
    if (args.length < numParams
        && params[numParams - 1].type === `DESTRUCTURING`) {
      return numParams - 1;
    }

    return -1;
  }
};

/***
 * JS Implementation of MurmurHash3 (r136) (as of May 20, 2011)
 *
 * @function external:murmurhash3_32_gc
 * @author <a href="mailto:gary.court@gmail.com">Gary Court</a>
 * @see http://github.com/garycourt/murmurhash-js
 * @author <a href="mailto:aappleby@gmail.com">Austin Appleby</a>
 * @see http://sites.google.com/site/murmurhash/
 *
 * @param {string} key ASCII only
 * @param {number} seed Positive integer only
 * @returns {number} 32-bit positive integer hash
 *
 * TODO export in HHM namespace?
 */
function murmurhash3_32_gc(key, seed) {
  var remainder, bytes, h1, h1b, c1, c1b, c2, c2b, k1, i;

  remainder = key.length & 3; // key.length % 4
  bytes = key.length - remainder;
  h1 = seed;
  c1 = 0xcc9e2d51;
  c2 = 0x1b873593;
  i = 0;

  while (i < bytes) {
    k1 =
        ((key.charCodeAt(i) & 0xff)) |
        ((key.charCodeAt(++i) & 0xff) << 8) |
        ((key.charCodeAt(++i) & 0xff) << 16) |
        ((key.charCodeAt(++i) & 0xff) << 24);
    ++i;

    k1 = ((((k1 & 0xffff) * c1) + ((((k1 >>> 16) * c1) & 0xffff) << 16))) & 0xffffffff;
    k1 = (k1 << 15) | (k1 >>> 17);
    k1 = ((((k1 & 0xffff) * c2) + ((((k1 >>> 16) * c2) & 0xffff) << 16))) & 0xffffffff;

    h1 ^= k1;
    h1 = (h1 << 13) | (h1 >>> 19);
    h1b = ((((h1 & 0xffff) * 5) + ((((h1 >>> 16) * 5) & 0xffff) << 16))) & 0xffffffff;
    h1 = (((h1b & 0xffff) + 0x6b64) + ((((h1b >>> 16) + 0xe654) & 0xffff) << 16));
  }

  k1 = 0;

  switch (remainder) {
    case 3: k1 ^= (key.charCodeAt(i + 2) & 0xff) << 16;
    case 2: k1 ^= (key.charCodeAt(i + 1) & 0xff) << 8;
    case 1: k1 ^= (key.charCodeAt(i) & 0xff);

      k1 = (((k1 & 0xffff) * c1) + ((((k1 >>> 16) * c1) & 0xffff) << 16)) & 0xffffffff;
      k1 = (k1 << 15) | (k1 >>> 17);
      k1 = (((k1 & 0xffff) * c2) + ((((k1 >>> 16) * c2) & 0xffff) << 16)) & 0xffffffff;
      h1 ^= k1;
  }

  h1 ^= key.length;

  h1 ^= h1 >>> 16;
  h1 = (((h1 & 0xffff) * 0x85ebca6b) + ((((h1 >>> 16) * 0x85ebca6b) & 0xffff) << 16)) & 0xffffffff;
  h1 ^= h1 >>> 13;
  h1 = ((((h1 & 0xffff) * 0xc2b2ae35) + ((((h1 >>> 16) * 0xc2b2ae35) & 0xffff) << 16))) & 0xffffffff;
  h1 ^= h1 >>> 16;

  return h1 >>> 0;
}

module.exports = FunctionReflector;
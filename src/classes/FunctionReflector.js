const functionReflector = require(`js-function-reflector`);
const hashFunction = require(`../hash`);

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
    const hash = hashFunction(
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
}

module.exports = FunctionReflector;
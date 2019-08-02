/**
 * Storage module.
 *
 * localForage is used to provide persistent storage.
 *
 * @see https://github.com/localForage/localForage
 * @module src/storage
 */

const localForage = require(`localforage`);

/**
 * LocalForage factory function.
 *
 * @alias module:src/storage.create
 * @async
 */
async function createStorage(config) {
  return localForage.createInstance(config);
}

module.exports.create = createStorage;
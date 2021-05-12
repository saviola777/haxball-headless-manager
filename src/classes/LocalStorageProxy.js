
/**
 * Provides proxy access to localStorage with key prefixes, so that each plugin has a clean
 * localStorage.
 *
 * _Important_: If you modify keys within the prefix of this proxy in the underlying localStorage
 * instance, you must call _rebuildKeyCache() afterwards.
 *
 * @class LocalStorageProxy
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Storage
 */
class LocalStorageProxy {
  constructor(prefix) {
    this._prefix = prefix + `.`;
    this._keys = new Set();
    this._rebuildKeyCache();
  }

  _rebuildKeyCache() {
    this._keys.clear();
    for (let i = 0; i < localStorage.length; i++)
    {
      const key = localStorage.key(i);

      if (key.startsWith(this._prefix)) {
        this._keys.add(key.substring(this._prefix.length));
      }
    }
  }

  get length() {
    this._keys.size;
  }

  key(n) {
    if (n >= this._keys.size) {
      return null;
    }

    return [...this._keys][n];
  }

  getItem(keyName) {
    return localStorage.getItem(this._prefix + keyName);
  }

  setItem(keyName, keyValue) {
    localStorage.setItem(this._prefix + keyName, keyValue);
    this._keys.add(keyName);
  }

  removeItem(keyName) {
    localStorage.removeItem(this._prefix + keyName);
    this._keys.delete(keyName)
  }

  clear() {
    const keys = [...this._keys];
    this._keys.clear();

    for (let k of keys) {
      localStorage.removeItem(this._prefix + k);
    }
  }
}

module.exports = LocalStorageProxy;
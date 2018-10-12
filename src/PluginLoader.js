/**
 * Plugin loader module.
 */

/**
 * Repository defaults.
 */
const repositoryDefaults = {
  suffix: `.js`
};

/**
 * PluginLoader class, responsible for loading plugins via repositories or via
 * code.
 */
module.exports = class PluginLoader {

  constructor(room, repositories) {
    this.room = room;

    this._prepareRepositoryConfigurations(repositories);
  }

  /**
   * Returns whether the plugin with the given name has been loaded.
   *
   * A plugin has been loaded if it exists (i.e. an attempt has been made to
   * load it) and it has made a call to HBInit().
   *
   * Plugins that do not interact with the headless room are not considered
   * valid and will not be marked as loaded.
   */
  _checkPluginLoaded(pluginId) {
    // Plugin doesn't exist
    if (!this.room._pluginManager.hasPluginById(pluginId)) {
      return false;
    }

    return this.room._pluginManager.getPluginById(pluginId)._accessed || false;
  }

  /**
   * Create and execute the plugin in a function context, passing a single
   * argument 'HBInit', which is a function returning the trapped room
   */
  _executePlugin(pluginSource, pluginRoom, pluginName) {
    const HBInit = () => {
      pluginRoom._accessed = true;
      return pluginRoom;
    };

    try {
      if (typeof pluginSource === `function`) {
        pluginSource(HBInit);
      } else {
        Function.apply(null, [`HBInit`, pluginSource])(HBInit);
      }
    } catch (e) {
      HHM.log.error(`Unable to execute plugin: ${e.message}`);
    }

    if (typeof pluginName !== `undefined`
        && pluginRoom.hasOwnProperty(`pluginSpec`)
        && !pluginRoom.pluginSpec.hasOwnProperty(`name`)) {
      // Assign it this way to trigger onPropertySet
      let pluginSpec = pluginRoom.pluginSpec;
      pluginSpec.name = pluginName;
      pluginRoom.pluginSpec = pluginSpec;
    }
  }

  /**
   * Loads a plugin with the given name from the given URL.
   *
   * The plugin will be loaded as plain text from the given URL (CORS policy
   * must be set properly at the given URL!) and then executed in a function
   * context.
   *
   * @see _createPluginFunction
   * @return Plugin ID if it was loaded or -1 otherwise
   */
  async _loadPlugin(pluginUrl, pluginName) {
    const that = this;
    let promise = -1;

    try {
      promise = await $.ajax({
        crossDomain: true,
        url: pluginUrl,
        dataType: `text`,
        success: pluginSource => {
          const pluginRoom = that.room.getPlugin(pluginName, true);

          that._executePlugin(pluginSource, pluginRoom,
              pluginName);

          pluginName = pluginRoom._name;

          if (!that._checkPluginLoaded(pluginRoom._id)) {
            HHM.log.error(
                `Repository did not return an error but plugin was not ` +
                `loaded for plugin ${pluginName}`);
            that.room._pluginManager._removePlugin(pluginRoom._id);
          } else {
            HHM.log.info(`Plugin loaded: ${pluginUrl}`);
          }
        },
      });
    } catch (e) {
      // Plugin not available from this repository, no action necessary
    }

    return typeof pluginName !== `undefined` && that.room.hasPlugin(pluginName)
        ? that.room._pluginManager.getPluginId(pluginName) : -1;
  }

  /**
   * Prepare the repository configurations.
   *
   * Merge defaults for missing values from repositoryDefaults.
   */
  _prepareRepositoryConfigurations(repositories) {
    this.repositories = [];
    let repositoryObject;
    for (let repository of repositories) {
      if (typeof repository === `string`) {
        repositoryObject = $.extend({ url: repository }, repositoryDefaults);
      } else {
        repositoryObject = $.extend({}, repositoryDefaults, repository);
      }

      this.repositories.push(repositoryObject);
    }
  }

  /**
   * Adds a repository.
   */
  addRepository(repository, suffix) {
    if (!repository.startsWith(`https`)) {
      HHM.log.warn(`Could not add repository at ${repository} because the `
        + `URL does not start with https`);
      return;
    }

    for (let repositoryObject of this.repositories) {
      if (repositoryObject.url === repository) {
        return;
      }
    }

    if (this.repositories.indexOf(repository) === -1) {
      this.repositories.push({
        url: repository,
        suffix: suffix || repositoryDefaults.suffix
      });
    }
  }

  /**
   * Tries to load a plugin from the plugin code.
   *
   * @return the ID of the plugin or -1 if it couldn't be loaded.
   */
  tryToLoadPluginByCode(pluginCode) {
    const pluginRoom = this.room.getPlugin();
    this._executePlugin(pluginCode, pluginRoom);

    return pluginRoom._id;
  }

  /**
   * Tries to load the given plugin from the configured repositories.
   *
   * @return the ID of the plugin or -1 if it couldn't be loaded.
   */
  async tryToLoadPluginByName(pluginName) {
    for (let repository of this.repositories) {
      let pluginUrl = repository.url + pluginName + repository.suffix;

      HHM.log.debug(`Trying to load plugin: ${pluginUrl} from repository ${repository}`);

      await this._loadPlugin(pluginUrl, pluginName);

      if (this.room.hasPlugin(pluginName)) {
        return this.room._pluginManager.getPluginId(pluginName);
      }
    }

    HHM.log.warn(`Unable to load plugin ${pluginName} from configured repositories`);

    return -1;
  }

  async tryToLoadPluginByUrl(url, pluginName) {
    let pluginId = -1;

    if (typeof pluginName !== `undefined` && this.room.hasPlugin(pluginName)) {
      return this.room._pluginManager.getPluginId(pluginName);
    }

    pluginId = this._loadPlugin(url, pluginName);

    if (pluginId === -1) {
      HHM.log.warn(`Unable to load plugin from URL ${url}`);
    }

    return pluginId;
  }
};
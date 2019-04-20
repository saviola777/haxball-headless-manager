// Do not edit this block unless you know what you are doing

HHM = typeof HHM === `undefined` ? {} : HHM;
HHM.baseUrl = HHM.baseUrl || `https://haxplugins.tk/`;
HHM.config = HHM.config || {};
haxroomie = typeof haxroomie === `undefined` ? {} : haxroomie;

// Start editing here

/**
 * Include your room config here (the object that will be passed to HBInit).
 *
 * If set to false, you will have to call PluginManager#start manually with a
 * room instance to start the plugin system.
 *
 * Please only adjust values on the right side of '||'.
 */
HHM.config.room = {
  roomName: haxroomie.roomName || `haxroomie`,
  playerName : haxroomie.playerName || `host`,
  maxPlayers: haxroomie.maxPlayers || 16,
  public : haxroomie.hasOwnProperty('public') ? haxroomie.public : false,
  password: haxroomie.password,
  geo: haxroomie.geo || {code: `FI`, lat: 60.192059, lon: 24.945831},
  token: haxroomie.token || "insert your token here"
};

/**
 * This function is executed after the plugin system was loaded and the room has
 * been started.
 *
 * Can be used to set initial room parameters or add custom event handlers.
 *
 * It is parsed like any other plugin, so it can have a plugin specification
 * with dependencies etc, or it can be a vanilla headless script.
 *
 * You can also pass the code as a string instead of a function.
 */
HHM.config.postInit = HBInit => {
  var room = HBInit();

  room.onRoomLink = () => {
    room.setDefaultStadium(`Big`);
    room.setScoreLimit(0);
    room.setTimeLimit(7);
  }
};

/**
 * This is the heart of the HHM config: a collection of plugins to load and
 * their corresponding configurations.
 *
 * The properties of this object should be plugin names, the values should be
 * configuration objects or an empty object if you want to use the default
 * configuration.
 *
 * You can use haxroomie.someProperty || `your default value` to support config
 * overrides from Haxroomie.
 */
HHM.config.plugins = {
  'sav/roles': {
    roles: {
      'host': ``,
      'admin': haxroomie.adminPassword || 'haxroomie'
    },
  },
  'sav/core': {},
};

/**
 * List of plugin repositories.
 *
 * When resolving plugin dependencies, the plugin manager will try to find a
 * JS file with the name of the plugin under each of these URLs. It will load
 * the first one it finds. Must include trailing slash if you want to directly
 * load JS files (as opposed to use a PHP script to serve the plugins, for
 * example).
 *
 * Each entry can either be a URL or an object containing the following
 * base properties:
 *
 *  - type: string identifying the repository type, default is 'plain'. See
 *    below for possible values
 *  - suffix: string that will be appended to the plugin name (optional,
 *    defaults to `.js`), may be ignored depending on the repository type
 *
 * Additionally, each repository type can define further properties. The
 * possible repository types are:
 *
 *  - plain: plain HTTP(s) repository. Additional properties:
 *    - url: base URL for the repository
 *  - github: GitHub repository. Plugins must be organized like
 *    /${path}/auth/plugin-name.js in the repository. Additional
 *    properties:
 *    - repository: GitHub repository identifier, i.e. username/repoName
 *    - branch: branch within the repository, defaults to `master`
 *    - path: path to the repository root within the GitHub repository, no
 *      leading slash (optional, defaults to `src/`)
 *
 * Plugins are loaded as text via $.ajax and then executed in a
 * new Function() context that receives a HBInit function, which can be used to
 * get a room instance like in a vanilla headless script.
 */
HHM.config.repositories = [
  {
    url: `${HHM.baseUrl}plugins/hhm-plugins/`,
  },
  {
    url: `${HHM.baseUrl}plugins/fm/`,
  },
  {
    type: `github`,
    repository: `saviola777/hhm-plugins`
  },
];

// Do not edit anything after this

// Load HHM if it has not already been loaded
if (HHM.manager === undefined) {
  let s = document.createElement(`script`);
  s.src = `${HHM.baseUrl}/hhm.js`;
  document.head.appendChild(s);
}
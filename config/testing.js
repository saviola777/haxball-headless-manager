HHM = typeof HHM === `undefined` ? {} : HHM;
HHM.baseUrl = HHM.baseUrl || `https://haxplugins.tk/testing/`;
HHM.config = HHM.config || {};

haxroomie = typeof haxroomie === `undefined` ? {} : haxroomie;

/**
 * Include your room config here (the object that will be passed to HBInit).
 *
 * If set to false, you will have to call PluginManager#start manually with a
 * room instance to start the plugin system.
 */
HHM.config.room = {
  roomName: haxroomie.roomName || `haxroomie`,
  playerName : haxroomie.playerName || `host`,
  maxPlayers: haxroomie.maxPlayers || 16,
  public : haxroomie.hasOwnProperty('public') ? haxroomie.public : false,
  password: haxroomie.password,
  geo: haxroomie.geo || {code: `FI`, lat: 60.192059, lon: 24.945831},
  token: haxroomie.token,
};

 HHM.config.postInit = HBInit => {
  let room = HBInit();

  room.onRoomLink = () => {
    room.setDefaultStadium(`Big`);
    room.setScoreLimit(0);
    room.setTimeLimit(7);
  }
};

HHM.config.plugins = {
  'sav/roles': {
    roles: {
      'host': ``,
      'admin': haxroomie.adminPassword || 'haxroomie'
    },
  },
  'sav/core': {},
};

HHM.config.repositories = [
  {
    url: `${HHM.baseUrl}plugins/hhm-plugins/`,
  },
  {
    url: `${HHM.baseUrl}plugins/fm/`,
  },
];

// Load HHM if it has not already been loaded
if (HHM.manager === undefined) {
  let s = document.createElement(`script`);
  s.src = `${HHM.baseUrl}/hhm.js`;
  document.head.appendChild(s);
}
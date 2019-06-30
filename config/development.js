// Do not edit this block unless you know what you are doing

HHM = typeof HHM === `undefined` ? {} : HHM;
HHM.config = HHM.config || {};
hrConfig = typeof hrConfig === `undefined` ? {} : hrConfig;

// Start editing here

HHM.config.version = hrConfig.hhmVersion || `git`;

HHM.config.room = {
  roomName: hrConfig.roomName || `haxroomie`,
  playerName : hrConfig.playerName || `host`,
  maxPlayers: hrConfig.maxPlayers || 16,
  public : hrConfig.hasOwnProperty('public') ? hrConfig.public : false,
  password: hrConfig.password,
  geo: hrConfig.geo || {code: `FI`, lat: 60.192059, lon: 24.945831},
  token: hrConfig.token || "insert your token here"
};

HHM.config.postInit = HBInit => {
  var room = HBInit();

  room.onRoomLink = () => {
    room.setDefaultStadium(`Big`);
    room.setScoreLimit(0);
    room.setTimeLimit(7);
  }
};

HHM.config.plugins = {
  'sav/roles': {
    roles: {
      'host': `haxroomie`,
      'admin': hrConfig.adminPassword || `haxroomie`
    },
  },
  'sav/core': {},
  'sav/plugin-control': {},
  'hr/spam': {},
};

HHM.config.repositories = [
  {
    type: `github`,
    repository: `saviola777/hhm-plugins`,
    version: `development`,
  },
  {
    type: `github`,
    repository: `morko/hhm-sala-plugins`,
  },
];

// Load HHM if it has not already been loaded
if (HHM.manager === undefined) {
  let s = document.createElement(`script`);
  s.src = `https://hhm.surge.sh/releases/hhm-${HHM.config.version}.js`;
  document.head.appendChild(s);
}
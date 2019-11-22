// Do not edit this block unless you know what you are doing

HHM = typeof HHM === `undefined` ? {} : HHM;
HHM.config = HHM.config || {};

// Start editing here

HHM.config.version = `git`;

HHM.config.room = {
  roomName: `haxroomie`,
  playerName : `host`,
  maxPlayers: 16,
  public : false,
  password: ``,
  geo: { code: `FI`, lat: 60.192059, lon: 24.945831 },
  token: `insert your token here`
};

HHM.config.postInit = HBInit => {
  var room = HBInit();

  room.onRoomLink = () => {
    // Start making changes here
    room.setDefaultStadium(`Big`);
    room.setScoreLimit(0);
    room.setTimeLimit(7);
  }
};

HHM.config.plugins = {
  'sav/roles': {
    roles: {
      'host': `hostpass CHANGE ME`,
      'admin': `adminpass CHANGE ME`
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
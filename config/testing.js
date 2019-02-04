HHM = typeof HHM === `undefined` ? {} : HHM;
HHM.baseUrl = HHM.baseUrl || `https://haxplugins.tk/testing/`;
HHM.config = HHM.config || {};

HHM.config.room = {
  roomName: `HHM room`,
  playerName : `:`,
  maxPlayers: 16,
  //password : `hhm`,
  public : false,
  geo: {code: `FI`, lat: 60.192059, lon: 24.945831},
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
  'sav/commands': {
    commandPrefix: `!`,
  },
  'sav/roles': {
    roles: {
      'host': `otherpw`,
      'admin': `somepw`,
    },
  },
  'sav/plugin-control': {},
  'sav/chat': {},
  'sav/players': {},
};

HHM.config.repositories = [
  {
    url: `${HHM.baseUrl}plugins/hhm-plugins/`,
  },
  {
    url: `${HHM.baseUrl}plugins/fm/`,
  },
];

HHM.config.dryRun = false;

HHM.config.trueHeadless = false;

HHM.config.sendChatMaxLength = 2686;

// Load HHM if it has not already been loaded
if (HHM.manager === undefined) {
  let s = document.createElement(`script`);
  s.src = `${HHM.baseUrl}/hhm.js`;
  document.head.appendChild(s);
}
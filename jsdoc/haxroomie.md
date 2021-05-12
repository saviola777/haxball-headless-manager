# <a name="haxroomie"></a> Haxroomie FAQ

This guide covers some of the basic questions and problems encountered when starting to use haxroomie.

## <a name="install"></a> Installing Haxroomie

TBD

## <a name="roomScript"></a> Using a roomScript

TBD

## <a name="roomScript_conversion"></a> Converting room scripts into plugins

First things first: every room script is automatically also a valid plugin, so you don't have to change anything in the room script.

First you have to create a directory where you want to put your plugins, in this example it will be `/root/git/haxroomie/packages/haxroomie-cli/plugins/`:

```bash
mkdir -p /root/git/haxroomie/packages/haxroomie-cli/plugins/src
```

Note that you have a subdirectory `src` inside the repository. This will be where the plugins are placed. Next you need to upload your room script to the VPS and know the exact path to it, in this example `/root/git/haxroomie/packages/haxroomie-cli/examples/roomScript.js`:

```bash
cp /root/git/haxroomie/packages/haxroomie-cli/examples/roomScript.js /root/git/haxroomie/packages/haxroomie-cli/plugins/src/roomScriptPlugin.js
```

Note that we called the target file `roomScriptPlugin.js`, this will be the name of our plugin (minus the `.js`). Repeat this for every room script you want to load, and make sure to change the name of `roomScriptPlugin.js` for each one, and note down all plugin names.

Next we create a local repository configuration in our haxroomie configuration file and then load the plugin from that repository:

```javascript
let config = {
  room1: {
    autoStart: true,
    roomName: `haxroomie`,
    playerName: `host`,
    maxPlayers: 10,
    public: false,
    repositories: [ // here starts the important part
      {
        type: `local`, // needs to be local
        path: `/root/git/haxroomie/packages/haxroomie-cli/plugins/`, // the path where you plugins are – without the "src" part!
      },
    ],
    pluginConfig: {
      'roomScriptPlugin': {}, // the room script we copied
      // you can add more plugins here in the same way
    }
  },
};
module.exports = config;
```

And that's it.
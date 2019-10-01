# Events

This guide will cover the HHM event handling in depth. It is not necessary to
read this if you just want to develop plugins, check out {@tutorial writing-plugins}
first if you are interested in that.

This guide is still WIP.

There are two types of events within the HHM system:

- local events, which are executed on one plugin only (e.g., when you call
  `room.getPlugin("abc/some-other-plugin").onEventHandler(args)`, you trigger a
  local event on the plugin `abc/some-other-plugin`)
- global events, which are executed on all plugins that define an event handler
  for it (e.g., when you call `room.triggerEvent("onEventHandler", args)`, you
  trigger the global event `onEventHandler` on all plugins)

To keep things simple, the name of events is always the same as the event
handler name, i.e. you trigger an event using its event handler name.

## Event handling loop

The event handling loop is defined in {@link TrappedRoomManager#onExecuteEventHandlers}
and consists of the following steps:

### Pre-event handler hooks

```javascript
// Execute pre-event handler hooks
if (this.preEventHandlerHooks[handlerName] !== undefined) {

  for (let pluginId of
      Object.getOwnPropertyNames(this.preEventHandlerHooks[handlerName])) {

    if (!this._isPluginEnabledAndLoaded(pluginId)) {
      continue;
    }

    const pluginName = this.room._pluginManager.getPluginName(pluginId);

    for (let hook of this.preEventHandlerHooks[handlerName][pluginId]) {
      let returnValue = hook({room: this.room,
            metadata: metadata.forPlugin(pluginName)}, ...args);

      args = Array.isArray(returnValue) ? returnValue : args;
      metadata.registerReturnValue(pluginName, returnValue);
    }
  }
}
```

First, all registered pre-event handler hooks for all enabled plugins are executed.
These hooks can return an `Array` which replaces the event arguments or any
other value which can be taken into account in the associated event state
validator. Unlike event handlers, pre-event handler hooks are always executed
regardless of intermediary event state modification.

To add pre-event handler hooks, call {@link HhmRoomObject#addPreEventHandlerHook}
with the handler name(s) for which you want to register a hook and the hook
function. Before the event arguments, an object with the properties `room`
({@link HhmRoomObject}) and `metadata` ({@link EventHandlerExecutionMetadata~Proxy})
is passed to the hooks. Here's an example for a pre-event handler hook:

```javascript
function onPlayerTeamChangePreEventHandlerHook({}, player) {
  getPlayerById(player.id, {}).team = player.team;
}
```

This function is part of the `sav/players` plugin's layer which removes asynchronity
from the room API, it essentially sets the player team to the new team right away
instead of waiting for the player to actually be moved to the team like the
native API does.

Since event arguments can be transformed by pre-event handler hooks and there
is no defined order for the execution of these hooks, try to avoid making
assumptions on the event arguments and do careful type and value checking where
applicable while at the same time avoiding unexpected argument transformation.

### Event state validation

```javascript
// If no validator was set, all states are considered valid
if (this.eventStateValidators[handlerName] === undefined) {
  return true;
}

// Return true unless at least one validator returns exactly false
for (let pluginName of
    Object.getOwnPropertyNames(this.eventStateValidators[handlerName])) {

  for (let validator of this.eventStateValidators[handlerName][pluginName]) {
    if (validator({ metadata: metadata }, ...args) === false) {
      return false;
    }
  }
}

return true;
```

Event state validation is performed as part of the main event handler execution
loop.

The reason we need event state validation is simple: consider the case when a
user joins the room, and the first `onPlayerJoin` handler decides that the user
should be kicked. When the second handler is executed, the player is no longer
in the room (or, worse, still in the room but in the process of being kicked),
we call this an _invalid event state_. Other examples include the game being
unpaused in the `onGamePause` handler, the game being stopped in the `onGameStart`
handler etc. The native API obviously didn't have this problem because it only
allows a single handler for each event type.

This takes the burden of making sure the room is in the correct state away from
the plugin authors, but it also means that, depending on the order of execution,
__certain handlers are not executed when their associated event happens__.

Event state validators can be added using {@link HhmRoomObject#addEventStateValidator}
where you pass the handler name(s) and hook functions. Here's an example for
an event state validator implementation:

```javascript
function onPlayerJoinEventStateValidator({}, player) {
  return player.online === true;
}
```

This is from the `sav/players` plugin and it uses the custom player property
`online` (which is set to false when a player leaves) to check if the player
is still in the room and returns `false` if the player is no longer online.
The first argument to any event state validator is an object containing (currently)
only one property `metadata`, which is an instance of {@link EventHandlerExecutionMetadata},
the rest correspond to the event arguments.

### Event handler execution

Event handler execution loop:

```javascript
// Execute event handlers
if (this.handlerExecutionOrders.hasOwnProperty(handlerName)) {
  for (let pluginId of this.handlerExecutionOrders[handlerName]) {
    // Skip disabled plugins
    if (!this._isPluginEnabledAndLoaded(pluginId)) {
      continue;
    }

    // Abort if event state not valid
    if (!this._isValidEventState(handlerName, metadata, ...args)) {
      break;
    }

    this.executeHandler(this.handlers[pluginId][handlerName], metadata,
            ...args);
  }
}
```

Event handler execution:

```javascript
let extraArgsPosition = this.functionReflector
    .getArgumentInjectionPosition(handler, args);

if (extraArgsPosition >= 0) {
  args = args.concat(Array(Math.max(0, extraArgsPosition - args.length))
      .fill(undefined)).concat(metadata.forPlugin(pluginName));
}

metadata.registerReturnValue(pluginName, handler(...args));
```

In the event handler execution loop you can see that disabled plugins are
skipped and the loop is aborted if the event state is no longer valid.

Before the handler is executed in the function {@link  TrappedRoomManager#_executeHandler},
the plugin-specific metadata object is injected into the handler arguments if
needed. This object is an instance of {@link EventHandlerExecutionMetadata~Proxy}
which gives limited access to the proxied metadata object and allows conventient
plugin-specific metadata storage.


### Post-event handler hooks

```javascript
// Execute post-event handler hooks
if (this.postEventHandlerHooks[handlerName] !== undefined) {
  for (let pluginId of Object.getOwnPropertyNames(
      this.postEventHandlerHooks[handlerName])) {

    if (!this._isPluginEnabledAndLoaded(pluginId)) {
      continue;
    }

    for (let hook of this.postEventHandlerHooks[handlerName][pluginId]) {
      hook({ room: this.room, metadata: metadata }, ...args);
    }
  }
}
```

Much like the pre-event handler hooks, the post-event handler hooks can be
registered with {@link HhmRoomObject#addPostEventHandlerHook} and will be
executed after the event handlers with the same arguments `room` and `metadata`.

They have a less important role than pre-event handler hooks in that they are
essentially handlers which are executed after the main event handler execution
loop finishes. They are always executed regardless of event state validation. If
you want to make sure your handler is executed but do not need it to be executed
before the event handler execution loop, register it as a post-event handler hook.

## HHM events

There's a number of events which are triggered as things happen within the
HHM plugin lifecycle. These are uninteresting in most situations and for most
plugin authors, but can be useful if you want to extend the HHM system or need
more control and react to plugin lifecycle events.

For each of the events listed below, two event handlers are called:

- `onHhm(args)`
- `onHhm_eventName(args)`

where `args` is a single object with the properties listed below plus a property
`eventName` which corresponds to one of the event names listed below and is
always included in the event arguments.

For example, a correct event handler for the event `eventHandlerSet` looks like
this:

```javascript
room.onHhm_eventHandlerSet = ({ plugin, handlerName, handler }) => {
  // Your event handler code
};
```

The available events are:

- `eventHandlerSet` and `eventHandlerUnset` for plugin event handlers being set /
  unset
- `propertySet` and `propertyUnset` for plugin properties being set / unset
- `pluginEnabled` and `pluginDisabled` for plugins being enabled and disabled
- `beforePluginLoaded`, `pluginLoaded` and `pluginRemoved` for plugins being
  loaded and removed
- `localEvent` for local events called on only one plugin

Each of these has a corresponding `HHM.events.` constant, see {@link HHM.events}
for more details on the events and event arguments.
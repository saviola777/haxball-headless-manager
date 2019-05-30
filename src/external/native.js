/**
 * This module contains documentation for components of the native headless API
 *
 * Most of this is copied from the official headless host
 * documentation by Mario Carbajal.
 *
 * @module
 * @external native-api
 * @see https://github.com/haxball/haxball-issues/wiki/Headless-Host
 */

/**
 * Room object provided by the native API.
 *
 * RoomObject is the main interface which lets you control the room and listen
 * to it's events.
 *
 * @namespace external:native-api.RoomObject
 * @see https://github.com/haxball/haxball-issues/wiki/Headless-Host#roomobject
 */

/**
 * Sends a chat message using the host player.
 *
 * If `targetId` is `null` or `undefined` the message is sent to all players.
 * If `targetId` is defined the message is sent only to the player with a
 * matching id.
 *
 * @function external:native-api.RoomObject.sendChat
 * @param {string} message Message to be displayed in the room.
 * @param {number} [targetId] If given, the message will only be displayed to
 *  the player with this ID.
 */

/**
 * Changes the admin status of the specified player.
 *
 * @function external:native-api.RoomObject.setPlayerAdmin
 * @param {number} playerID ID of the player to give or remove admin to/from.
 * @param {boolean} admin `true` to give admin status, `false` to remove it.
 */

/**
 * Moves the specified player to a team.
 *
 * @function external:native-api.RoomObject.setPlayerTeam
 * @param {number} playerID ID of the player whose team is changed.
 * @param {number} team ID of the player's new team.
 * @see https://github.com/haxball/haxball-issues/wiki/Headless-Host#teamid
 */

/**
 * Kicks the specified player from the room.
 *
 * TODO does ban still only use IP or auth as well?
 *
 * @function external:native-api.RoomObject.kickPlayer
 * @param {number} playerID ID of the player to be kicked.
 * @param {string} reason Text that will displayed to the user after they are
 *  kicked.
 * @param {boolean} ban Whether to ban the player as well.
 */

/**
 * Clears the ban for a `playerId` that belonged to a player that was previously
 * banned.
 *
 * @function external:native-api.RoomObject.clearBan
 * @param {number} playerId ID of a player that was banned before.
 */

/**
 * Clears the list of banned players.
 *
 * @function external:native-api.RoomObject.clearBans
 */

/**
 * Sets the score limit of the room.
 *
 * If a game is in progress this method does nothing.
 *
 * @function external:native-api.RoomObject.setScoreLimit
 * @param {number} limit Number indicating the number of goals necessary before
 *  a team is declared winner.
 */

/**
 * Sets the time limit of the room. The limit must be specified in number of
 * minutes.
 *
 * If a game is in progress this method does nothing.
 *
 * @function external:native-api.RoomObject.setTimeLimit
 * @param {number} limitInMinutes New time limit in minutes.
 */

/**
 * Parses the `stadiumFileContents` as a `.hbs` stadium file and sets it as the
 * selected stadium.
 *
 * There must not be a game in progress, if a game is in progress this method
 * does nothing.
 *
 * See example [here](https://github.com/haxball/haxball-issues/blob/master/headless/examples/setCustomStadium.js).
 *
 * @function external:native-api.RoomObject.setCustomStadium
 * @param {string} stadiumFileContents `.hbs` file as a string.
 */

/**
 * Sets the selected stadium to one of the default stadiums. The name must match
 * exactly (case sensitive).
 *
 * There must not be a game in progress, if a game is in progress this method
 * does nothing.
 *
 * @function external:native-api.RoomObject.setDefaultStadium
 * @param {string} stadiumName One of the default stadium names (case-sensitive).
 */

/**
 * Sets the teams lock.
 *
 * When teams are locked players are not able to change team unless they are
 * moved by an admin.
 *
 * @function external:native-api.RoomObject.setTeamsLock
 * @param {boolean} locked Whether to lock unlock teams.
 */

/**
 * Sets the colors of a team.
 *
 * Colors are represented as an integer, for example a pure red color is
 * `0xFF0000`.
 *
 * @function external:native-api.RoomObject.setTeamColors
 * @param {number} team ID of the team whose color should be changed.
 * @param {number} angle Angle of the color dividers.
 * @param {number} textColor Text color as hex RGB value.
 * @param {Array.<number>} colors Up to three different colors.
 */

/**
 * Starts the game, if a game is already in progress this method does nothing.
 *
 * @function external:native-api.RoomObject.startGame
 */

/**
 * Stops the game, if no game is in progress this method does nothing.
 *
 * @function external:native-api.RoomObject.stopGame
 */

/**
 * Sets the pause state of the game.
 *
 * @function external:native-api.RoomObject.pauseGame
 * @param {boolean} pauseState `true` = paused and `false` = unpaused.
 */

/**
 * Returns the player with the specified id. Returns `null` if the player doesn't
 * exist.
 *
 * @function external:native-api.RoomObject.getPlayer
 * @param {number} playerId ID of the player to be returned.
 * @returns {(external:native-api.PlayerObject|null)} The player with the
 *  specified id or `null` if the player doesn't exist.
 */

/**
 * Returns the current list of players.
 *
 * @function external:native-api.RoomObject.getPlayerList
 * @returns {Array.<external:native-api.PlayerObject>} Array of players in the
 *  room.
 */

/**
 * If a game is in progress it returns the current score information. Otherwise
 * it returns `null`
 *
 * @function external:native-api.RoomObject.getScores
 * @returns {(external:native-api.ScoresObject|null)} Score information or `null`.
 */

/**
 * Returns the ball's position in the field or `null` if no game is in progress.
 *
 * @function external:native-api.RoomObject.getBallPosition
 * @returns {(Object.<string, number>|null)} Object with `x` and `y` properties
 *  or `null`.
 */

/**
 * Starts recording of a haxball replay.
 *
 * Don't forget to call `stopRecording` or it will cause a memory leak.
 *
 * @function external:native-api.RoomObject.startRecording
 */

/**
 * Stops the recording previously started with startRecording and returns the
 * replay file contents as a Uint8Array.
 *
 * Returns `null` if recording was not started or had already been stopped.
 *
 * @function external:native-api.RoomObject.stopRecording
 * @returns {(Uint8Array|null)} Replay file as `Uint8Array` or `null`.
 */

/**
 * Changes the password of the room, if pass is null the password will be cleared.
 *
 * @function external:native-api.RoomObject.setPassword
 * @param {(string|null)} pass New password or `null` to clear the password.
 */

/**
 * Event called when a new player joins the room.
 *
 * @function external:native-api.RoomObject.onPlayerJoin
 * @param {external:native-api.PlayerObject} player The player who joined.
 */

/**
 * Event called when a player leaves the room.
 *
 * @function external:native-api.RoomObject.onPlayerLeave
 * @param {external:native-api.PlayerObject} player The player who left.
 */

/**
 * Event called when a team wins.
 *
 * @function external:native-api.RoomObject.onTeamVictory
 * @param {external:native-api.ScoresObject} scores Score information.
 */

/**
 * Event called when a player sends a chat message.
 *
 * @function external:native-api.RoomObject.onPlayerChat
 * @param {external:native-api.PlayerObject} player The player who sent the
 *  message.
 * @param {string} message The chat message.
 * @returns {boolean} The event function can return `false` in order to filter
 *  the chat message. This prevents the chat message from reaching other players
 *  in the room.
 */

/**
 * Event called when a player kicks the ball.
 *
 * @function external:native-api.RoomObject.onPlayerBallKick
 * @param {external:native-api.PlayerObject} player The player who kicked the
 *  ball.
 */

/**
 * Event called when a team scores a goal.
 *
 * @function external:native-api.RoomObject.onTeamGoal
 * @param {number} team ID of the team that scored.
 */

/**
 * Event called when a game starts.
 *
 * @function external:native-api.RoomObject.onGameStart
 * @param {external:native-api.PlayerObject} byPlayer The player which caused
 *  the event (can be null if the event wasn't caused by a player).
 */

/**
 * Event called when a game stops.
 *
 * @function external:native-api.RoomObject.onGameStop
 * @param {external:native-api.PlayerObject} byPlayer The player which caused
 *  the event (can be null if the event wasn't caused by a player).
 */

/**
 * Event called when a player's admin rights are changed.
 *
 * @function external:native-api.RoomObject.onPlayerAdminChange
 * @param {external:native-api.PlayerObject} changedPlayer The player whose
 *  admin rights were changed.
 * @param {external:native-api.PlayerObject} byPlayer The player which caused
 *  the event (can be null if the event wasn't caused by a player).
 */

/**
 * Event called when a player team is changed.
 *
 * @function external:native-api.RoomObject.onPlayerTeamChange
 * @param {external:native-api.PlayerObject} changedPlayer The player whose team
 *  was changed.
 * @param {external:native-api.PlayerObject} byPlayer The player which caused
 *  the event (can be null if the event wasn't caused by a player).
 */

/**
 * Event called when a player has been kicked from the room. This is always
 * called after the onPlayerLeave event.
 *
 * @function external:native-api.RoomObject.onPlayerKicked
 * @param {external:native-api.PlayerObject} kickedPlayer The player that was
 *  kicked.
 * @param {string} reason The reason that was displayed to the kicked player.
 * @param {boolean} ban Whether the player was banned.
 * @param {external:native-api.PlayerObject} byPlayer The player which caused
 *  the event (can be null if the event wasn't caused by a player).
 */

/**
 * Event called once for every game tick (happens 60 times per second).
 *
 * This is useful if you want to monitor the player and ball positions without
 * missing any ticks.
 *
 * This event is not called if the game is paused or stopped.
 *
 * @function external:native-api.RoomObject.onGameTick
 */

/**
 * Event called when the game is paused.
 *
 * @function external:native-api.RoomObject.onGamePause
 * @param {external:native-api.PlayerObject} byPlayer The player which caused
 *  the event (can be null if the event wasn't caused by a player).
 */

/**
 * Event called when the game is unpaused.
 *
 * After this event there's a timer before the game is fully unpaused, to detect
 * when the game has really resumed you can listen for the first onGameTick
 * event after this event is called.
 *
 * @function external:native-api.RoomObject.onGameUnpause
 * @param {external:native-api.PlayerObject} byPlayer The player which caused
 *  the event (can be null if the event wasn't caused by a player).
 */

/**
 * Event called when the players and ball positions are reset after a goal
 * happens.
 *
 * @function external:native-api.RoomObject.onPositionsReset
 */

/**
 * Event called when a player gives signs of activity, such as pressing a key.
 *
 * This is useful for detecting inactive players.
 *
 * @function external:native-api.RoomObject.onPlayerActivity
 * @param {external:native-api.PlayerObject} player The player for whom activity
 *  has been detected.
 */

/**
 * Event called when the stadium is changed.
 *
 * @function external:native-api.RoomObject.onStadiumChange
 * @param {string} newStadiumName Name of the new stadium.
 * @param {external:native-api.PlayerObject} byPlayer The player which caused
 *  the event (can be null if the event wasn't caused by a player).
 *
 */

/**
 * Event called when the room link is obtained.
 *
 * @function external:native-api.RoomObject.onRoomLink
 * @param {string} url The full URL of the room.
 */


/**
 * PlayerObject holds information about a player.
 *
 * @property {number} id The id of the player, each player that joins the room
 *  gets a unique id that will never change.
 * @property {string} name The name of the player.
 * @property {number} team The team of the player.
 * @property {boolean} admin Whether the player has admin rights.
 * @property {Object.<number, number>} position The player's position in the
 *  field, if the player is not in the field the value will be null.
 * @property {number} position.x X coordinate of the position
 * @property {number} position.y Y coordinate of the position
 * @property {string} auth The player's public ID. Can be null if the ID
 *  validation fails. This property is only set in the
 *  {@link external:native-api.RoomObject.onPlayerJoin} event.
 * @property {string} conn Desc
 *
 * @namespace external:native-api.PlayerObject
 * @see https://github.com/haxball/haxball-issues/wiki/Headless-Host#playerobject
 */

/**
 * Room configuration object.
 *
 * @property {string} roomName The name for the room.
 * @property {string} playerName The name for the host player.
 * @property {string} [password] The password for the room (no password if
 *  ommited).
 * @property {number} maxPlayers Max number of players the room accepts.
 * @property {boolean} public If `true` the room will appear in the room list.
 * @property {Object} geo GeoLocation override for the room. See
 *  {@link https://developers.google.com/public-data/docs/canonical/countries_csv}
 * @property {string} geo.code Two character country code.
 * @property {number} geo.lat GPS Latitude value.
 * @property {number} geo.lon GPS longitude value.
 * @property {string} token Can be used to skip the recaptcha by setting it to a
 *  token that can be obtained [here](https://www.haxball.com/headlesstoken).
 *  These tokens will expire after a few minutes.
 *
 * @namespace external:native-api.RoomConfigObject
 * @see https://github.com/haxball/haxball-issues/wiki/Headless-Host#roomconfigobject
 */

/**
 * Holds information relevant to the current game scores.
 *
 * @property {number} red The number of goals scored by the red team.
 * @property {number} blue The number of goals scored by the blue team.
 * @property {number} time The number of seconds elapsed (seconds don't advance
 *  while the game is paused).
 * @property {number} scoreLimit The score limit for the game.
 * @property {number} timeLimit The time limit for the game.
 *
 * @namespace external:native-api.ScoresObject
 * @see https://github.com/haxball/haxball-issues/wiki/Headless-Host#scoresobject
 */

/**
 * Room initialization function.
 *
 * Use this function to initialize the room, it returns the room object used to
 * control the room.
 *
 * After calling this function a recaptcha challenge will appear, after passing
 * the recaptcha the room link will appear on the page.
 *
 *
 * @param {external:native-api.RoomConfigObject} roomConfig Room configuration.
 * @returns {external:native-api.RoomObject} Room object.
 * @function external:native-api.HBInit
 * @see https://github.com/haxball/haxball-issues/wiki/Headless-Host#hbinitroomconfig--roomconfigobject--roomobject
 */
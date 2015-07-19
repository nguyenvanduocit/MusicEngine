var express = require( 'express' );
var app = express();
var http = require( 'http' ).createServer( app );
var io = require( "socket.io" )( http );
var uuid = require( 'node-uuid' );
var _ = require( 'underscore' )._;
var backbone = require( 'backbone' );
var request = require( 'request' );
/**
 * Rounting
 */
require( './config' )( app, express, http );
require( './routes' )( app, io );

var MusicEngine = {};

MusicEngine.Collections = {};
MusicEngine.Models = {};

MusicEngine.Collections.Song = backbone.Collection.extend( {} );
MusicEngine.Collections.Room = backbone.Collection.extend( {} );
MusicEngine.Collections.Message = backbone.Collection.extend( {} );
MusicEngine.Models.Song = backbone.Model.extend( {
	defaults: {
		'own': 'un-own',
		'url': 'un-url',
		'name': 'un-name',
		'performer': 'un-name',
		'image': '',
		'score': 0
	}
} );
MusicEngine.Models.Message = backbone.Model.extend( {
	defaults: {
		'username': 'un-username',
		'msg': 'un-msg'
	}
} );
MusicEngine.Models.Room = backbone.Model.extend( {
	defaults: {
		'players': 0,
		'songs': new MusicEngine.Collections.Song(),
		'memberCount': 0,
		'isPlaying': false,
		'volume': 1,
		'voteNext': 0,
		'currentSongId': 0
	}
} );

var MusicEngineApplication = {
	initialize: function () {
		this.Models = {};
		this.Collections = {};
		this.pubsub = {};
		_.extend( this.pubsub, backbone.Events );
		this.roomList = new MusicEngine.Collections.Room();
		this.songList = new MusicEngine.Collections.Song();
		this.maxUser = 100;
		this.nextVoteRequired = 2;
	},
	run: function () {
		var self = this;
		this.io = io.on( 'connection', function ( socket ) {
			self.onClientConnect( socket );
		} );
	},
	getNextSong: function () {
		if ( this.songList.length > 0 ) {
			return this.songList.at( 0 );
		}
		else {
			return null;
		}
	},
	removeSong: function ( songId, roomId ) {
		this.songList.remove( {id: songId} );
		var room = this.roomList.findWhere( {id: roomId} );
		var currentSongId = room.get( 'currentSongId' );
		if ( songId == currentSongId ) {
			room.set( 'currentSongId', 0 );
		}
		io.sockets.to( roomId ).emit( 'song.remove', songId );
	},
	playNextSong: function ( roomId ) {
		var nextSong = this.getNextSong();
		var room = this.roomList.findWhere( {id: roomId} );
		if ( nextSong !== null ) {
			room.set( 'currentSongId', nextSong.get( 'id' ) );
			io.sockets.to( roomId ).emit( 'player.play', nextSong.toJSON() );
			room.set( 'isPlaying', true );
			return true;
		}
		else {
			io.sockets.to( roomId ).emit( 'playlist.empty', {msg: 'There are no song'} );
			room.set( 'isPlaying', false );
			return false;
		}
	},
	/**
	 * On the first time client connecto to server
	 * @param data
	 * @param socket
	 */
	onClientInit: function ( data, socket ) {
		var existRoom = this.roomList.findWhere( {id: data.room} );
		var result = {isAllowed: true};
		if ( existRoom ) {
			if ( data.type == 'player' ) {
				if ( existRoom.get( 'players' ) != 0 ) {
					result = {isAllowed: false, msg: 'The player is connect, your are not allowed to join as player'};
				}
			} else {
				var clientInRoom = existRoom.get( 'memberCount' );
				console.log( clientInRoom );
				if ( clientInRoom > this.maxUser ) {
					result = {isAllowed: false, msg: 'The room is full.'};
				}
			}
		}
		console.log( socket.id + " : INIT " + data.type + " want to join room # " + data.room );
		socket.emit( 'client.init.result', result );
		if ( ! result.isAllowed ) {
			socket.disconnect();
		}
	},
	onClientLogin: function ( data, socket ) {
		var isAllowed = true;
		var room = this.roomList.findWhere( {id: data.room} );
		var message = new MusicEngine.Models.Message();
		message.set( 'id', uuid.v1() );
		message.set( 'username', 'System' );

		if ( room ) {
			/**
			 * The room is exist
			 */
			message.set( 'msg', 'You joined the room #' + data.room + ", Send this page's address to your friend to have fun." );
			var clientInRoom = room.get( 'memberCount' );
			clientInRoom ++;
			room.set( 'memberCount', clientInRoom );
			console.log( 'There are ' + clientInRoom + ' member in room #' + data.room );
			if ( data.type == 'player' ) {
				if ( room.get( 'players' ) != 0 ) {
					socket.emit( 'client.login.result', {
						success: false,
						msg: 'The player is connect, your are not allowed to join as player'
					} );
				}
				else {
					console.log( 'player connected' );
					room.set( 'players', socket.id );
					socket.broadcast.to( data.room ).emit( 'player.connect', data );
				}
			}
		}
		else {
			/**
			 * The room is not exist
			 */
			message.set( 'msg', 'You Create the room #' + data.room );
			console.log( socket.id + ' created the room #' + data.room );
			room = new MusicEngine.Models.Room( {id: data.room, memberCount: 1} );
			this.roomList.add( room );
			if ( data.type == 'player' ) {
				console.log( 'player connected' );
				room.set( 'players', socket.id );
				socket.broadcast.to( data.room ).emit( 'player.connect', data );
			}

		}

		if ( isAllowed ) {
			socket.username = data.username;
			/**
			 * TODO : We allow this socket int onClientInit, so let check to sync the condition
			 */
			socket.room = data.room;
			socket.type = data.type;
			socket.join( socket.room );

			socket.emit( 'client.login.result', {success: true} );
			io.sockets.to( socket.room ).emit( 'client.connect', _.extend( data, {id: socket.id} ) );
			console.log( socket.id + " : LOGINED name " + socket.username );
			socket.emit( 'message.recive', message.toJSON() );
			socket.emit( 'player.volumeChange', {volume: room.get( 'volume' )} );
		}
		else {
			socket.disconnect();
		}

	},
	onClientDisconnect: function ( socket ) {
		console.log( 'Disconnected : ' + socket.id );
		var existRoom = this.roomList.findWhere( {id: socket.room} );
		if ( existRoom ) {
			var clientInRoom = existRoom.get( 'memberCount' );
			clientInRoom --;
			existRoom.set( 'memberCount', clientInRoom );
			console.log( 'There are ' + clientInRoom + ' member in room #' + socket.room );
			if ( clientInRoom == 0 ) {
				this.roomList.remove( existRoom );
				console.log( 'the room #' + socket.room + ' was removed' );
			}
			else {
				if ( socket.type === 'player' ) {
					existRoom.set( 'players', 0 );
					console.log( 'Player disconnected' );
					socket.broadcast.to( socket.room ).emit( 'player.disconnect' );
				}
			}
		}
		socket.broadcast.to( socket.room ).emit( 'client.leave', {id: socket.id} );
		socket.leave( socket.room );
	},
	onFetchPlaylist: function ( socket ) {
		socket.emit( 'playlist.fetch.result', this.songList.toJSON() );
	},
	onSubmitSong: function ( data, socket ) {
		var self = this;
		var message = new MusicEngine.Models.Message();
		message.set( 'id', uuid.v1() );
		message.set( 'username', 'System' );
		message.set( 'msg', 'Your song is being processed !' );
		/**
		 * Response the status to sender that we processing the song
		 */
		socket.emit( 'song.submit.result', message.toJSON() );
		console.log( "Processing : " + data.url );
		request( 'http://lab.senviet.org/getlink/getlink.php?url=' + data.url, function ( error, response, body ) {
			if ( ! error && response.statusCode == 200 ) {
				try {
					var result = JSON.parse( body );
					if ( result.success ) {
						var songList = result.data;
						if ( songList.length > 0 ) {
							message.set( 'msg', 'Success, you submit play list, but we only accept the first song.' );
						}
						var songData = songList[ 0 ];
						var song = new MusicEngine.Models.Song();
						song.set( 'id', uuid.v1() );
						song.set( 'own', socket.username );
						song.set( 'url', songData.location );
						song.set( 'image', songData.image );
						song.set( 'performer', songData.performer );
						song.set( 'name', songData.title );
						self.songList.add( song );
						/**
						 * Send add song result
						 */
						message.set( 'msg', 'The song ' + songData.title + ' is enqueued !' );
						socket.emit( 'song.submit.result', message.toJSON() );
						/**
						 * Broadcast new song added
						 */
						io.to( socket.room ).emit( 'song.add', song.toJSON() );
						var room = self.roomList.findWhere( {id: socket.room} );
						var isPlaying = room.get( 'isPlaying' );
						if ( ! isPlaying ) {
							self.playNextSong( socket.room );
						}
					}
					else {
						message.set( 'msg', 'Your url is not valid.' );
						socket.emit( 'song.submit.result', message.toJSON() );
					}
				} catch ( e ) {
					message.set( 'msg', 'Error : ' + e.message );
					socket.emit( 'song.submit.result', message.toJSON() );
				}
				console.log( "END : " + data.url );
			}
		} );
	},
	onPlayerStageUpdate: function ( data, socket ) {
		var stage = data.stage;
		switch ( stage ) {
			case 'firstLoad':
				this.playNextSong( socket.room );
				var room = this.roomList.get( {id: socket.room} );
				socket.emit( 'player.control.volume', {value: room.get( 'volume' )} );
				break;
			case 'end':
				this.removeSong( data.song.id, socket.room );
				this.playNextSong( socket.room );
				break;
			case 'pause':
				socket.broadcast.to( socket.room ).emit( 'song.pause', data );
				break;
			case 'playing':
				socket.broadcast.to( socket.room ).emit( 'song.playing', data );
				break;
		}
	},
	/**
	 * handle on volume change event from player
	 * @param volume
	 * @param socket
	 */
	onVolumeChange: function ( data, socket ) {
		socket.broadcast.to( socket.room ).emit( 'player.volumeChange', data );
		var room = this.roomList.findWhere( {id: socket.room} );
		room.set( 'volume', data.volume );
	},
	/**
	 * Handle vote request from member
	 * @param data
	 * @param socket
	 */
	onVoteRequest: function ( data, socket ) {
		var action = data.action;
		var room = this.roomList.findWhere( {id: socket.room} );
		switch ( action ) {
			case 'next':
				var message = new MusicEngine.Models.Message();
				message.set( 'id', uuid.v1() );
				message.set( 'username', 'System' );
				var currentVote = room.get( 'voteNext' );
				var newVote = currentVote + 1;
				if ( newVote >= this.nextVoteRequired ) {
					/**
					 * Reach max vote, go to next song and reset vote
					 */
					room.set( 'voteNext', 0 );
					var currentSongId = room.get( 'currentSongId' );
					if ( currentSongId != 0 ) {
						this.removeSong( currentSongId, socket.room );
					}
					var result = this.playNextSong( socket.room );

					if ( result ) {
						message.set( 'msg', socket.username + ' vote next' );
						socket.broadcast.to( socket.room ).emit( 'message.recive', message.toJSON() );

						message.set( 'id', uuid.v1() );
						message.set( 'msg', 'Play next song by ' + this.nextVoteRequired + ' vote.' );
						io.sockets.to( socket.room ).emit( 'message.recive', message.toJSON() );
					}
					else {
						message.set( 'msg', 'Can not play next song' );
						socket.emit( 'message.recive', message.toJSON() );
						newVote = currentVote;
					}
				}
				else {
					/**
					 * Update vote count
					 */
					room.set( 'voteNext', newVote );
					message.set( 'msg', 'You vote next, ' + (
						this.nextVoteRequired - newVote
						) + ' votes to next.' );
					socket.emit( 'message.recive', message.toJSON() );
					message.set( 'id', uuid.v1() );
					message.set( 'msg', socket.username + ' vote next' );
					socket.broadcast.to( socket.room ).emit( 'message.recive', message.toJSON() );
				}
				io.sockets.to( socket.room ).emit( 'vote.change', {voteValue: newVote} );
				break;
			case 'volume':
				var newVolume = data.value;
				var playerId = room.get( 'players' );
				room.set( 'volume', newVolume );
				socket.broadcast.to( socket.room ).emit( 'player.volumeChange', {volume: data.value} );
				if ( playerId != 0 ) {
					io.sockets.connected[ playerId ].emit( 'player.control.volume', {value: newVolume} );
				}
				break;
		}
	},
	onMemberListRequest: function ( data, socket ) {
		var res = [];
		var ns = io.of( "/" );    // the default namespace is "/"
		var roomId = socket.room;
		if ( ns ) {
			for ( var id in ns.connected ) {
				if ( roomId ) {
					var index = ns.connected[ id ].rooms.indexOf( roomId );
					if ( index !== - 1 ) {
						res.push( {
							id: id,
							username: ns.connected[ id ].username
						} );
					}
				} else {
					res.push( {
						id: id,
						username: ns.connected[ id ].username
					} );
				}
			}
		}
		socket.emit( 'member.list.fetch.result', {members: res} );
	},
	/**
	 *
	 * @param socket
	 */
	onClientConnect: function ( socket ) {

		var self = this;
		console.log( socket.id + " : CONNECTED" );

		socket.on( 'client.init', function ( data ) {
			self.onClientInit( data, socket );
		} );

		socket.on( 'client.login', function ( data ) {
			self.onClientLogin( data, socket );
		} );

		socket.on( 'disconnect', function () {
			self.onClientDisconnect( socket );
		} );

		socket.on( 'playlist.fetch', function () {
			self.onFetchPlaylist( socket );
		} );

		socket.on( 'song.submit', function ( data ) {
			self.onSubmitSong( data, socket );
		} );
		socket.on( 'player.stage', function ( data ) {
			self.onPlayerStageUpdate( data, socket );
		} );
		socket.on( 'player.volumeChange', function ( data ) {
			self.onVolumeChange( data, socket );
		} );
		socket.on( 'vote', function ( data ) {
			self.onVoteRequest( data, socket );
		} );
		socket.on( 'member.list.fetch', function ( data ) {
			self.onMemberListRequest( data, socket );
		} );
	},

};
MusicEngineApplication.initialize();
MusicEngineApplication.run();

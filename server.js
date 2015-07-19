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

MusicEngine.Collections.Song = backbone.Collection.extend({});
MusicEngine.Collections.Room = backbone.Collection.extend({});
MusicEngine.Collections.Message = backbone.Collection.extend({});
MusicEngine.Models.Song = backbone.Model.extend({
	defaults: {
		'own': 'un-own',
		'url': 'un-url',
		'name': 'un-name',
		'performer': 'un-name',
		'image': '',
		'score': 0
	}
});
MusicEngine.Models.Message = backbone.Model.extend({
	defaults: {
		'username': 'un-username',
		'msg': 'un-msg'
	}
});
MusicEngine.Models.Room = backbone.Model.extend({
	defaults: {
		'players': null,
		'songs': [],
		'memberCount':1
	}
});

var MusicEngineApplication = {
	initialize: function() {
		this.Models = {};
		this.Collections = {};
		this.pubsub = {};
		_.extend(this.pubsub, backbone.Events);
		this.roomList = new MusicEngine.Collections.Room();
		this.songList = new MusicEngine.Collections.Song();
		this.maxUser = 100;
	},
	run : function(){
		var self = this;
		this.io = io.on( 'connection',function(socket) {
			self.onClientConnect(socket);
		});
	},
	getNextSong:function(){
		if(this.songList.length > 0)
		{
			return this.songList.at(0);
		}
		else{
			return null;
		}
	},
	removeSong:function(songId, socket){
		this.songList.remove({id:songId});
		io.to( socket.room ).emit('song.remove', songId);
	},
	playNextSong:function(socket){
		var nextSong = this.getNextSong();
		if(nextSong !== null) {
			socket.emit( 'player.play', nextSong.toJSON() );
			return true;
		}
		return false;
	},
	/**
	 * On the first time client connecto to server
	 * @param data
	 * @param socket
	 */
	onClientInit:function(data, socket){
		var existRoom = this.roomList.findWhere({id:socket.room});
		if(existRoom){
			var clientInRoom = existRoom.get('memberCount');
			if(clientInRoom > this.maxUser){
				socket.emit( 'client.init.result', {isAllowed: false, msg:'The room is full.'});
			}
			if(data.type ==='player')
			{
				if(existRoom.get('players')){
					socket.emit( 'client.init.result', {isAllowed: false, msg:'The player is connect, your are not allowed to join as player'});
				}
			}

		}
		console.log(socket.id + " : INIT " + data.type + " want to join room # " + data.room);
		socket.emit( 'client.init.result', {isAllowed: true});
	},
	onClientLogin:function(data, socket){
		socket.username = data.username;
		/**
		 * TODO : We allow this socket int onClientInit, so let check to sync the condition
		 */
		socket.room = data.room;
		socket.type = data.type;
		socket.join( socket.room );

		socket.emit( 'client.login.result', {success: true});
		socket.broadcast.to( socket.room ).emit( 'client.connect', data );
		console.log(socket.id + " : LOGINED name " + socket.username);

		var existRoom = this.roomList.findWhere({id:socket.room});
		var message = new MusicEngine.Models.Message();
		message.set('id',uuid.v1());
		message.set('username','System');

		if(existRoom){
			/**
			 * The room is exist
			 */
			message.set('msg', 'You joined the room #' + socket.room);
			var clientInRoom = existRoom.get('memberCount');
			clientInRoom++;
			existRoom.set('memberCount', clientInRoom);
			console.log('There are ' + clientInRoom + ' member in room #' + socket.room);
			if(socket.type =='player'){
				if(existRoom.get('players')){
					socket.emit( 'client.login.result', {success: false, msg:'The player is connect, your are not allowed to join as player'});
				}
				else
				{
					existRoom.set('players', socket);
				}
			}
		}
		else{
			/**
			 * The room is not exist
			 */
			message.set('msg', 'You Create the room #' + socket.room);
			console.log(socket.id + ' created the room #' + socket.room);
			var room = new MusicEngine.Models.Room({id:socket.room});
			this.roomList.add(room);

		}
		socket.emit( 'message.recive', message.toJSON());

	},
	onClientDisconnect: function(socket){
		if ( socket.type === 'player' ) {
			socket.broadcast.to( socket.room ).emit( 'player.stop' );
		}
		socket.leave( socket.room );
		console.log( 'Disconnected : ' + socket.id );
		var existRoom = this.roomList.findWhere({id:socket.room});
		if(existRoom){
			var clientInRoom = existRoom.get('memberCount');
			clientInRoom--;
			existRoom.set('memberCount', clientInRoom);
			console.log('There are ' + clientInRoom + ' member in room #' + socket.room);
			if(clientInRoom == 0){
				this.roomList.remove(existRoom);
				console.log('the room #'+socket.room + ' was removed');
			}
		}

	},
	onFetchPlaylist:function(socket){
		socket.emit('playlist.fetch.result', this.songList.toJSON());
	},
	onSubmitSong: function (data, socket){
		var self = this;
		var message = new MusicEngine.Models.Message();
		message.set('id',uuid.v1());
		message.set('username','System');
		message.set('msg', 'Your song is being processed !');
		/**
		 * Response the status to sender that we processing the song
		 */
		socket.emit('song.submit.result', message.toJSON());
		console.log("Processing : " + data.url);
		request('http://lab.senviet.org/getlink/getlink.php?url='+data.url, function (error, response, body) {
			if (!error && response.statusCode == 200) {
				try{
					var result = JSON.parse(body);
					if(result.success)
					{
						var songList = result.data;
						if(songList.length > 0){
							message.set('msg', 'Success, you submit play list, but we only accept the first song.');
						}
						var songData = songList[0];
						var song = new MusicEngine.Models.Song();
						song.set('id',uuid.v1());
						song.set('own',socket.username);
						song.set('url', songData.location);
						song.set('image', songData.image);
						song.set('performer', songData.performer);
						song.set('name', songData.title);
						self.songList.add(song);
						/**
						 * Send add song result
						 */
						message.set('msg', 'The song ' + songData.title + ' is enqueued !');
						socket.emit('song.submit.result', message.toJSON());
						/**
						 * Broadcast new song added
						 */
						io.to(socket.room ).emit('song.add', song.toJSON());
					}
					else
					{
						message.set('msg', 'Your url is not valid.');
						socket.emit('song.submit.result', message.toJSON());
					}
				}catch(e){
					message.set('msg', 'Error : ' + e.message);
					socket.emit('song.submit.result', message.toJSON());
				}
				console.log("END : " + data.url);
			}
		});
	},
	onPlayerStageUpdate:function(data, socket){
		var stage = data.stage;
		switch (stage){
			case 'firstLoad':
				this.playNextSong(socket);
				break;
			case 'end':
				this.removeSong(data.song.id, socket);
				this.playNextSong(socket);
				break;
			case 'pause':
				socket.broadcast.to( socket.room ).emit('song.pause', data);
				break;
			case 'playing':
				socket.broadcast.to( socket.room ).emit('song.playing', data);
				break;
		}
	},
	onVolumeChange:function(volume, socket){
		socket.broadcast.to( socket.room ).emit('player.volumeChange', volume);
	},
	onVoteRequest:function(data, socket){
		var action = data.action;
		var message = new MusicEngine.Models.Message();
		message.set('id',uuid.v1());
		message.set('username','System');
		message.set('msg', 'Thanks for your vote');
		socket.emit('message.recive', message.toJSON());
	},
	/**
	 *
	 * @param socket
	 */
	onClientConnect : function(socket){

		var self = this;
		console.log(socket.id + " : CONNECTED");

		socket.on( 'client.init',function(data){
			self.onClientInit(data, socket);
		});

		socket.on( 'client.login',function(data){
			self.onClientLogin(data, socket);
		});

		socket.on( 'disconnect', function () {
			self.onClientDisconnect(socket);
		} );

		socket.on('playlist.fetch', function(){
			self.onFetchPlaylist(socket);
		});

		socket.on('song.submit', function(data){
			self.onSubmitSong(data, socket);
		});
		socket.on('player.stage', function(data){
			self.onPlayerStageUpdate(data, socket);
		});
		socket.on('player.volumeChange', function(data){
			self.onVolumeChange(data, socket);
		});
		socket.on('vote', function(data){
			self.onVoteRequest(data, socket);
		});
	},

};
MusicEngineApplication.initialize();
MusicEngineApplication.run();

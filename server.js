var express = require( 'express' );
var app = express();
var http = require( 'http' ).createServer( app );
var io = require( "socket.io" )( http );
var npid = require( "npid" );
var uuid = require( 'node-uuid' );
var _ = require( 'underscore' )._;
var backbone = require( 'backbone' );
var request = require( 'request' );
/**
 * Rounting
 */
require( './config' )( app, express, http );
require( './routes' )( app, io );

var MusicEngineApplication = {};

MusicEngineApplication = _.extend(MusicEngineApplication,{
	render:function(){

	},
	initialize: function() {
		this.Models = {};
		this.Collections = {};
		this.pubsub = {};
		_.extend(this.pubsub, backbone.Events);

		this.maxUser = 100;
		this.isPlaying = false;
		this.Collections.Song = backbone.Collection.extend({});
		this.Models.Song = backbone.Model.extend({
			defaults: {
				'own': 'un-own',
				'url': 'un-url',
				'name': 'un-name',
				'score': 0
			}
		});
		this.listenTo(this.Collections.Song, 'add', this.onSongAdded);
	},
	run : function(){
		var self = this;
		this.io = io.on( 'connection',function(socket) {
			self.onClientConnect(socket);
		});
	},
	onSongAdded: function(){

	},
	/**
	 * On the first time client connecto to server
	 * @param data
	 * @param socket
	 */
	onClientInit:function(data, socket){
		console.log(socket.id + " : INIT " + data.type + " want to join room # " + data.room);
		/**
		 * TODO calc total client count
		 */
		if(1 < this.maxUser){
			socket.emit( 'client.init.result', {isAllowed: true});
		}
		else
		{
			socket.emit( 'client.init.result', {isAllowed: false, msg:'The room is full.'});
		}
	},
	onClientLogin:function(data, socket){
		console.log(socket.id + " : LOGIN");
		socket.username = data.username;
		/**
		 * TODO : We allow this socket int onClientInit, so let check to sync the condition
		 */
		socket.room = data.room;
		socket.type = data.type;
		socket.join( socket.room );
		socket.emit( 'client.login.result', {success: true});
		socket.broadcast.to( socket.room ).emit( 'client.connect', data );
	},
	onClientDisconnect: function(socket){
		if ( socket.type === 'player' ) {
			socket.broadcast.to( socket.room ).emit( 'player.stop' );
		}
		socket.leave( socket.room );
		console.log( 'Disconnected : ' + socket.id );
	},
	onFetchPlaylist:function(socket){
		socket.emit('playlist.fetch.result', this.Collections.Song.toJSON());
	},
	onSubmitSong: function (data, socket){
		var song_id =uuid.v4();
		var song = new Song();
		song.set('id',song_id);
		song.set('own',socket.name);
		song.set('url', '');
		song.set('name', '');
		song.set('status', 'processing');
		song.set('score', 0);
		/**
		 * Response the status to sender that we processing the song
		 */
		socket.emit('song.submit.result', song.toJSON());


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
	},

});
MusicEngineApplication.initialize();
MusicEngineApplication.run();

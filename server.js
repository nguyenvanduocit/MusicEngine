var express = require( 'express' );
var app = express();
var http = require( 'http' ).createServer( app );
var io = require( "socket.io" )( http );
var npid = require( "npid" );
var Song = require( './song.js' );
var uuid = require( 'node-uuid' );
var _ = require( 'underscore' )._;
/**
 * Rounting
 */
require('./config')(app, express, http);
require('./routes')(app, io);
/**
 * Define some var
 */
var maxUser = 100;
var maxPlayer = 100;
var songList = [];
var player = [];
/**
 * On connection
 */
var chat = io.on( 'connection', function ( socket ) {
	console.log("Connected : " + socket.id);
	socket.on('load',function(data){

		var room = findClientsSocket(io,data);
		if(room.length === 0 ) {

			socket.emit('peopleinchat', {number: 0});
		}
		else if(room.length < maxUser) {

			socket.emit('peopleinchat', {
				number: room.length,
				user: room[0].username,
				id: data
			});
			socket.emit('song.list', songList);
		}
		else if(room.length >= maxUser) {

			chat.emit('tooMany', {boolean: true});
		}
	});

	// and add them to the room
	socket.on('member.login', function(data) {

		var room = findClientsSocket(io, data.id);
		if (room.length < maxUser) {
			socket.username = data.user;
			socket.room = data.id;
			socket.type = 'member';

			// Add the client to the room
			socket.join(data.id);
			// Send the startChat event to all the people in the
			// room, along with a list of people that are in it.
			chat.in(data.id).emit('login.result', {success:true,id: data.id});
		}
		else {
			socket.emit('tooMany', {boolean: true});
		}
	});
	/**
	 * Player login
	 */
	socket.on('player.login', function(data) {

		if (player.length < maxPlayer) {
			/**
			 * Set the data for socket
			 */
			socket.name = data.name;
			socket.room = data.roomId;
			socket.type = 'player';
			/**
			 * Join this socket to the room
			 */
			socket.join(data.roomId);
			/**
			 * response the result for socket
			 */
			socket.emit('player.login.result', {success:true, msg:'Wellcome to the room #' + socket.room});
			socket.emit('playlist.songList', songList);
		}
		else {
			socket.emit('player.login.result', {success: false, msg:'The room is full of player'});
		}
	});
	/**
	 * On client disconnected
	 */
	socket.on('disconnect', function() {
		// leave the room
		socket.leave(socket.room);
		if(socket.type === 'player'){
			console.log('Player disconnected : ' + socket.id);
		}else{
			console.log('member disconnected : ' + socket.id);
		}
	});


	// Handle the sending of messages
	socket.on('msg', function(data){
		var song = new Song(data.user, data.msg);
		songList.push(song);
		/**
		 * Send the song to player
		 */
		socket.broadcast.to(socket.room).emit('song.add', song);
	});

} );
/**
 * @param io
 * @param roomId
 * @param namespace
 * @returns {Array}
 */
function findClientsSocket(io,roomId, namespace) {
	var res = [],
		ns = io.of(namespace ||"/");    // the default namespace is "/"

	if (ns) {
		for (var id in ns.connected) {
			if(roomId) {
				var index = ns.connected[id].rooms.indexOf(roomId) ;
				if(index !== -1) {
					res.push(ns.connected[id]);
				}
			}
			else {
				res.push(ns.connected[id]);
			}
		}
	}
	return res;
}
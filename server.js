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
var songList = [];
/**
 * On connection
 */
var chat = io.on( 'connection', function ( socket ) {

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
	socket.on('login', function(data) {

		var room = findClientsSocket(io, data.id);
		if (room.length < maxUser) {
			socket.username = data.user;
			socket.room = data.id;

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
	// Somebody left the chat
	socket.on('disconnect', function() {
		// leave the room
		socket.leave(socket.room);
	});


	// Handle the sending of messages
	socket.on('msg', function(data){
		songList.push(new Song(data.user, data.msg));
		// When the server receives a message, it sends it to the other person in the room.
		socket.broadcast.to(socket.room).emit('receive', {msg: data.msg, user: data.user});
	});

} );

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
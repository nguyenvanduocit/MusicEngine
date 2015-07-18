var express = require( 'express' );
var app = express();
var http = require( 'http' ).createServer( app );
var io = require( "socket.io" )( http );
var npid = require( "npid" );
var uuid = require( 'node-uuid' );
var _ = require( 'underscore' )._;
var backbone = require( 'backbone' );
var request = require('request');
/**
 * Rounting
 */
require('./config')(app, express, http);
require('./routes')(app, io);
/**
 * Define some var
 */
var maxUser = 100;
var songList = new backbone.Collection();
var Song = backbone.Model.extend();
var isPlaying = false;
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
			socket.emit('playlist.songList', songList);
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
	});
	socket.on('song.nextSong', playNextSong);

	/**
	 * On client disconnected
	 */
	socket.on('disconnect', function() {
		if(socket.type ==='player'){
			socket.broadcast.to(socket.room ).emit('player.stop');
		}
		socket.leave(socket.room);
		console.log('Disconnected : ' + socket.id);
	});
	/**
	 * Player event
	 */
	socket.on('player.duration', function(data){
		var durationInfo = {
			duration:data.duration,
			songId:data.songId
		};
		socket.broadcast.to(socket.room ).emit('player.duration', durationInfo);
	});
	/**
	 * On player finished the song
	 */
	socket.on('player.song.end', function(data){
		var info  ={
			songId:data.songId
		};
		songList.remove(data.songId);
		socket.broadcast.to(socket.room ).emit('player.song.end', info);
		io.in(socket.room).emit('song.remove', info);
		playNextSong();
	});

	/**
	 * On user submit the song
	 */
	socket.on('song.submit', function(data){
		var msg_id =uuid.v4();
		/**
		 * Response the status to sender that we processing the song
		 */
		socket.emit('song.submit.result', {msg:'processing',id:msg_id, name:'System'});
		/**
		 * Request the mp3 source
		 */
		request('http://lab.wordpresskite.com/getlink/?link='+data.url, function (error, response, body) {
			if (!error && response.statusCode == 200) {
				try{
					var data = JSON.parse(body);
					var song = new Song();
					song.set('id',msg_id);
					song.set('own',socket.name);
					song.set('url', data.location);
					song.set('name', data.title);
					songList.add(song);
					/**
					 * Send add song result
					 */
					io.in(socket.room).emit('song.add', song);
					if(!isPlaying){
						playNextSong();
					}
				}catch(e){
					socket.emit('message.update', {msg:'This url is not vaild',id:msg_id, name:'error'});
				}
			}
		})
	});

	function playNextSong(){
		if(songList.length > 0){
			isPlaying = true;
			var nextSong = songList.at(Math.floor(Math.random()*songList.length));
			io.in(socket.room).emit('song.play', nextSong);
		}
		else
		{
			isPlaying = false;
			io.in(socket.room).emit('song.nomore', {msg:'No more song to play'});
		}
	}

});

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
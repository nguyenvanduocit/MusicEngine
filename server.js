var express = require('express');
var app = express();
var http = require('http').createServer(app);
var io = require("socket.io")(http);
var npid = require("npid");
var Song = require('./song.js');
var uuid = require('node-uuid');
var _ = require('underscore')._;

app.set("ipaddr", "127.0.0.1");
app.set("port", 8181);
app.set("views", __dirname + "/views");
app.set("view engine", "jade");

app.use(express.static("public", __dirname + "/public"));
app.use('/components', express.static(__dirname + '/components'));

/**
 * Rounting
 */
app.get("/", function(request, response) {
	response.render("index");
});

app.get("/admin", function(request, response) {
	response.render("admin");
});

app.get("/player", function(request, response) {
	response.render("player");
});
/**
 * Define some var
 */
var songList = {};
var userList = [];
var roomName = 'music_room';
/**
 * On connection
 */
io.on('connection', function(socket){

	if( _.indexOf(userList, socket) == -1)
	{
		/**
		 * If user is not exist
		 */
		socket.join(roomName);
		/**
		 * Send to current user
		 */
		socket.emit('member.join', {msg:'Welcome'});
		socket.emit('member.list', userList);
		/**
		 * Send to another user
		 */
		socket.broadcast.emit('member.join', {msg:'User join'});
	}
	/**
	 * On disconnection
	 */
	socket.on('disconnect', function(){
		userList = _.without(userList, socket);
		socket.broadcast.emit('member.leave', {msg:'User leave'});
	});

	/**
	 * FOR USER
	 */
	socket.on('song.submit', function(data){
		var songURL = data.songURL;
		if(_.indexOf(songList, songURL) == -1){
			socket.emit('song.submit.result', {result:'success',msg:'Added'});
			songList.push(songURL);
		}
		else{
			socket.emit('song.submit.result', {result:'exist', msg:'This song is already added !'});
		}
	});
	socket.on('song.vote', function(data){});
	/**
	 * FOR PLAYER
	 */
	socket.on('song.next', function(data){});
	/**
	 * FOR ADMIN
	 */
	socket.on('song.delete', function(data){});

	function isSongExist(url){
		if( _.find()){
			return true;
		}
		else{
			return false;
		}
	}
});

http.listen(app.get("port"), app.get("ipaddr"), function() {
	console.log("Server up and running. Go to http://" + app.get("ipaddr") + ":" + app.get("port"));
});
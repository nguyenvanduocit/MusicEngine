function init() {
	var socket = io();
	var sessionId = '';
	socket.on( 'connect', function () {
		sessionId = socket.io.engine.id;
		console.log( 'Connected ' + sessionId );
	} );

	socket.on('member.join',function(data){
		console.log(data.msg);
	});
	socket.on('member.list',function(userList){
		console.log(userList);
	});

	socket.on('member.leave',function(data){
		console.log(data.msg);
	});

	socket.on('song.submit.result',function(data){
		console.log(data.msg);
	});

}

$( document ).on( 'ready', init );
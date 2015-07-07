function init() {

	var socket = io();
	var sessionId = '';

	var $songList = $( '#songList' );
	var $memberList = $( '#memberList' );
	var $submitForm = $( '#submitForm' );

	socket.on( 'connect', function ( data ) {
		sessionId = socket.io.engine.id;
		console.log( 'Connected ' + sessionId );

	} );

	socket.on( 'connect.result', function ( data ) {
		if (data.result == 'success') {
			/**
			 * Join success
			 */
			$( '#submitButton' ).removeAttr( 'disabled' );
		}
	} );

	socket.on( 'member.join', function ( member ) {
		addMember(member);
	} );

	socket.on( 'member.list', function ( userList ) {
		console.log( userList );
	} );

	socket.on( 'member.leave', function ( data ) {
		console.log( data.msg );
	} );

	socket.on( 'song.submit.result', function ( data ) {
		console.log(data);
	} );

	socket.on( 'song.new', function ( song ) {
		addSong(song);
	} );

	socket.on( 'song.delete', function ( data ) {
		$songList.find( '#' + data.id ).remove();
	} );

	socket.on( 'song.list', function ( songList ) {
		for(var index = 0; index < songList.length; index++){
			addSong(songList[index]);
		}
	});

	function addSong( song ) {
		console.log(song);
		var $songLi = $( '<li>' + song.name + '</li>' );
		$songLi.data( 'url', song.url );
		$songList.append( $songLi );
	}
	function addMember(member){
		console.log(member);
		var $memberLi = $( '<li>' + song.name + '</li>' );
		$memberList.append( $memberLi );
	}
	/**
	 * PLAYER
	 */
	$submitForm.on( 'submit', function ( e ) {
		e.preventDefault();
		var $target = $( e.currentTarget);
		var $url = $target.find('input[name="url"]');
		var $name = $target.find('input[name="name"]');
		socket.emit('song.submit', {url:$url.val(), name:$name.val()});
	} );

}

$( document ).on( 'ready', init );
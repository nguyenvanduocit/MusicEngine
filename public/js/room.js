// This file is executed in the browser, when people visit /chat/<random id>

$(function(){
	// getting the id of the room from the url
	var id = Number(window.location.pathname.match(/\/room\/(\d+)$/)[1]);

	// connect to the socket
	var socket = io();

	// variables which hold the data for each person
	var name = "";
	// cache some jQuery objects
	var section = $(".section"),
		footer = $("footer"),
		onConnect = $(".connected"),
		inviteSomebody = $(".invite-textfield"),
		personInside = $(".personinside"),
		chatScreen = $(".chatscreen");
	// some more jquery objects
	var chatNickname = $(".nickname-chat"),
		loginForm = $(".loginForm"),
		yourName = $("#yourName"),
		hisName = $("#hisName"),
		chatForm = $("#chatform"),
		textarea = $("#message"),
		chats = $(".chats");


	// on connection to server get the id of person's room
	socket.on('connect', function(){
		socket.emit('load', id);
	});

	socket.on('song.list', function(songList){
		console.log(songList);
		for(var index = 0;index<songList.length; index++){
			createChatMessage(songList[index].url, songList[index].name);
		}
	});
	// receive the names and avatars of all people in the chat room
	socket.on('peopleinchat', function(data){

		if(data.number === 0){

			showMessage("connected");

			loginForm.on('submit', function(e){

				e.preventDefault();

				name = $.trim(yourName.val());

				if(name.length < 1){
					alert("Please enter a nick name longer than 1 character!");
					return;
				}
				showMessage("inviteSomebody");
				// call the server-side function 'login' and send user's parameters
				socket.emit('member.login', {roomname:'',user: name, id: id});
			});
		}

		else {

			showMessage("personinchat",data);

			loginForm.on('submit', function(e){

				e.preventDefault();

				name = $.trim(hisName.val());

				if(name.length < 1){
					alert("Please enter a nick name longer than 1 character!");
					return;
				}

				if(name == data.user){
					alert("There already is a \"" + name + "\" in this room!");
					return;
				}
					socket.emit('member.login', {user: name, id: id});
			});
		}
	});

	// Other useful

	socket.on('login.result', function(data){
		console.log(data);
		if(data.success && data.id == id) {
			showMessage("startChat",data);
		}
	});


	socket.on('tooMany', function(data){

		if(data.boolean && name.length === 0) {

			showMessage('tooManyPeople');
		}
	});

	socket.on('song.add', function(song){
		showMessage('startChat');
		createChatMessage(song.url, song.name);
	});

	textarea.keypress(function(e){

		// Submit the form on enter

		if(e.which == 13) {
			e.preventDefault();
			chatForm.trigger('submit');
		}

	});

	chatForm.on('submit', function(e){

		e.preventDefault();

		// Create a new chat message and display it directly

		showMessage("startChat");

		if(textarea.val().trim().length) {
			createChatMessage(textarea.val(), name);

			// Send the message to the other person in the chat
			socket.emit('msg', {msg: textarea.val(), user: name});

		}
		// Empty the textarea
		textarea.val("");
	});
	// Somebody left the chat
	socket.on('disconnect', function(data) {
		showMessage('disconnect', data);
	});
	// Function that creates a new chat message

	function createChatMessage(msg,user){

		var li = $(
			'<li class="me">'+
			'<b></b>' +
			'<p></p>' +
			'</li>');

		// use the 'text' method to escape malicious user input
		li.find('p').text(msg);
		li.find('b').text(user);
		li.hide();
		chats.prepend(li);
		li.slideDown();
	}

	function showMessage(status,data){

		if(status === "connected"){

			section.children().css('display', 'none');
			onConnect.fadeIn(1200);
		}

		else if(status === "inviteSomebody"){

			// Set the invite link content
			$("#link").text(window.location.href);

			onConnect.fadeOut(1200, function(){
				inviteSomebody.fadeIn(1200);
			});
		}

		else if(status === "personinchat"){

			onConnect.css("display", "none");
			personInside.fadeIn(1200);
			chatNickname.text(data.user);
		}

		else if(status === "startChat") {
			inviteSomebody.fadeOut(1200);
			personInside.fadeOut(1000);
			footer.fadeIn(1200);
			chatScreen.fadeIn(1200);
		}
		else if(status ==='disconnect'){
			location.reload();
		}
	}

});

// This file is required by app.js. It sets up event listeners
// for the two main URL endpoints of the application - /create and /chat/:id
// and listens for socket.io messages.


// Export a function, so that we can pass 
// the app and io instances from the app.js file:

module.exports = function(app,io){

	app.get('/', function(request, response){
		response.render('index');
	});

	app.get(['/create','/room'], function(request, response){

		// Generate unique id for the room
		var id = Math.round((Math.random() * 1000000));

		// Redirect to the random room
		response.redirect('/room/'+id);
	});

	app.get('/room/:id', function(request, response){
		response.render( "room" );
	});

	app.get('/player/:id', function(request, response){
		response.render( "player" );
	});

	app.get('/admin', function(request, response){
		response.render( "admin" );
	});


};


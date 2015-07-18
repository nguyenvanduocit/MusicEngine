_.templateSettings = {
	evaluate: /\<\#(.+?)\#\>/g,
	interpolate: /\{\{=(.+?)\}\}/g,
	escape: /\{\{-(.+?)\}\}/g
};
var socket = io();
var Application = Backbone.Marionette.Application.extend( {} );
MusicEngine = window.MusicEngine || new Application();
(
	function ( $, Backbone, Marionate, socket, MusicEngine ) {

		MusicEngine.Models = MusicEngine.Models || {};
		MusicEngine.Collections = MusicEngine.Collections || {};
		MusicEngine.Views = MusicEngine.Views || {};
		MusicEngine.Routers = MusicEngine.Routers || {};
		// the pub/sub object for managing event throughout the app
		MusicEngine.pubsub = MusicEngine.pubsub || {};
		_.extend( MusicEngine.pubsub, Backbone.Events );

		$( document ).ready( function () {
			MusicEngine.roomId = Number( window.location.pathname.match( /\/room\/(\d+)$/ )[ 1 ] );
			MusicEngine.on( 'start', function () {
				Backbone.history.start();
			} );
			socket.on( 'connect', function () {
				/**
				 * TODO handler on reconnect event
				 */
				MusicEngine.start();
			} );
			socket.on( 'disconnect', function () {
				console.log( 'You are disconnected' );
			} );
		} );
	}
)( jQuery, Backbone, Backbone.Marionette, socket, MusicEngine );
/**
 * Module
 */
(
	function ( $, Backbone, Marionate, socket, MusicEngine, Views, Models, Collections ) {
		Models.Song = Backbone.Model.extend( {} );
		Collections.Song = Backbone.Collection.extend( {} );
		Views.Song = Marionate.ItemView.extend( {
			template: "#songItem-template",
		} );
		/**
		 * Song submit Regon
		 */
		var songSubmitRegion = Marionate.Region.extend({});
		Views.songSubmitView = Marionette.CompositeView.extend({
			template: "#songsubmit-template",
			events:{
				'submit #songSubmitForm':'onSubmit'
			},
			initialize:function(options){
				_.extend(this.options, options);
			},
			onSubmit:function(e){
				e.preventDefault();
				var $target = $( e.currentTarget);
				var $urlInput = $target.find('input[name="url"]');
				var url = $urlInput.val();
				socket.emit('song.submit', {url:url});
			}
		});
		/**
		 * Login
		 */
		var loginRegion = Marionate.Region.extend({});

		Views.LoginForm = Marionette.CompositeView.extend({
			template: "#login-template",
			events:{
				'submit #loginForm':'onSubmit'
			},

			onSubmit:function(e){
				e.preventDefault();
				var $target = $( e.currentTarget);

				var $userNameInput = $target.find('input[name="username"]');
				var username = $userNameInput.val();
				socket.emit('client.login', {username:username, room:MusicEngine.roomId});
			}

		});
		/**
		 * Playlist
		 */
		var playListRegion = Marionate.Region.extend( {} );
		Views.PlayList = Marionette.CollectionView.extend( {
			template: "#playlist-template",
			childView: Views.Song,
			onShow: function () {
				socket.emit('playlist.fetch.result');
			}
		} );
		/**
		 * Define the module
		 */
		var RoomModule = Marionette.Module.extend( {
			initialize: function ( options, moduleName, app ) {
				_.extend( this.options, options );
				this.songCollection = new Collections.Song();
				this.playListView = new Views.PlayList( {
					collection: this.songCollection
				} );
				this.loginView = new Views.LoginForm();
				this.songSubmitView = new Views.songSubmitView();
				this.initViewEvent();
				this.initSocketEvent();
				this.initRegion();
			},
			initViewEvent: function () {
				this.listenTo(MusicEngine.pubsub, 'client.init.result', this.onInitResult);
				this.listenTo(MusicEngine.pubsub, 'client.login.result', this.onLoginResult);
			},
			initSocketEvent: function () {
				var self = this;
				socket.on( 'client.init.result', function ( data ) {
					self.onInitResult(data);
					MusicEngine.pubsub.trigger('client.init.result', data);
				} );

				socket.on( 'client.login.result', function ( data ) {
					MusicEngine.pubsub.trigger('client.login.result', data);
				} );

				socket.on( 'playlist.fetch.result', function ( data ) {
					MusicEngine.pubsub.trigger('playlist.fetch.result', data);
				} );

				socket.on( 'song.submit.result', function ( data ) {
					MusicEngine.pubsub.trigger('song.submit.result', data);
				} );
			},
			onLoginResult:function(data){
				if(data.success){
					MusicEngine.loginRegion.empty();
					MusicEngine.playListRegion.show(this.playListView);
					MusicEngine.songSubmitRegion.show(this.songSubmitView);
				}
				else{
					alert('Login is not successed');
				}
			},
			onInitResult:function(data){
				if(data.isAllowed){
					/**
					 * Login success
					 */
					MusicEngine.loginRegion.show(this.loginView);
				}
				else
				{
					alert('You are not allowed : ' + data.msg);
				}
			},
			initRegion: function () {
				MusicEngine.addRegions( {
					playListRegion: {
						el: '#playListRegion',
						regionClass: playListRegion
					},
					loginRegion: {
						el: '#loginRegion',
						regionClass: loginRegion
					},
					songSubmitRegion: {
						el: '#songSubmitRegion',
						regionClass: songSubmitRegion
					},
				} );
			},
			onStart: function ( options ) {
				socket.emit('client.init', {room:MusicEngine.roomId, type:'player'});
			},
			onStop: function ( options ) {

			}
		} );
		/**
		 * Register the module with application
		 */
		MusicEngine.module( "RoomModule", RoomModule );
	}
)( jQuery, Backbone, Backbone.Marionette, socket, MusicEngine, MusicEngine.Views, MusicEngine.Models, MusicEngine.Collections );
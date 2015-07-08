_.templateSettings = {
	evaluate: /\<\#(.+?)\#\>/g,
	interpolate: /\{\{=(.+?)\}\}/g,
	escape: /\{\{-(.+?)\}\}/g
};
var socket = io();
var Application = Backbone.Marionette.Application.extend({});
MusicEngine = window.MusicEngine || new Application();
(
	function ( $, Backbone, Marionate,socket, MusicEngine ) {

		MusicEngine.Models = MusicEngine.Models || {};
		MusicEngine.Collections = MusicEngine.Collections || {};
		MusicEngine.Views = MusicEngine.Views || {};
		MusicEngine.Routers = MusicEngine.Routers || {};
		// the pub/sub object for managing event throughout the app
		MusicEngine.pubsub = MusicEngine.pubsub || {};

		$( document ).ready( function () {
			MusicEngine.on( 'start', function () {
				Backbone.history.start();
			} );
			socket.on('connect', function(){
				/**
				 * TODO handler on reconnect event
				 */
				MusicEngine.start();
			});
			socket.on('disconnect', function(){
				console.log('You are disconnected');
			});
		} );
	}
)( jQuery, Backbone,Backbone.Marionette,socket, MusicEngine );

/**
 * MODULE
 */

(
	function ( $, Backbone, Marionate,socket, MusicEngine, Views, Models, Collections ) {

		var roomId = Number(window.location.pathname.match(/\/player\/(\d+)$/)[1]);

		var playListRegion = Marionate.Region.extend({
		});

		Collections.Song = Backbone.Collection.extend({

		});

		Collections.Song.comparator = function(model) {
			return model.get('score');
		};

		Views.Song  = Marionate.ItemView.extend({
			template: "#songItem-template",
		});

		Views.PlayList =  Marionette.CollectionView.extend({

			template: "#playlist-template",
			childView: Views.Song,
			initialize:function(options){

			},
			onShow:function(){}
		});

		/**
		 * Define the module
		 */
		var PlayerModule = Marionette.Module.extend( {
			initialize: function ( options, moduleName, app ) {
				_.extend( this.options, options );
				this.songCollection = new Collections.Song();
				this.playListView = new Views.PlayList({
					collection:this.songCollection
				});
				this.initSocketEvent();
				this.initRegion();
				this.login();
				this.startPlay();
			},
			initSocketEvent : function(){

				var that = this;

				socket.on('player.login.result', function(data){
					that.loginHandler(data);
				});
				socket.on('playlist.songList', function(data){
					that.songListHandler(data);
				});
				socket.on('song.add', function(data){
					that.onSongAdd(data);
				});
				socket.on('song.delete', function(data){
					that.onSongDelete(data);
				});
				socket.on('song.play', function(data){
					that.onPlaySong(data);
				});
			},

			login:function(){
				var player_name = 'Player #' + roomId;
				socket.emit('player.login', {name:player_name, roomId: roomId});
			},

			initRegion:function(){

				MusicEngine.addRegions({
					playListRegion: {
						el: '#playListRegion',
						regionClass: playListRegion
					}
				});
			},
			startPlay:function(){
				socket.emit('song.nextSong');
			},
			onPlaySong:function(song){
				console.log(song);
			},
			onSongAdd: function(song){
				this.songCollection.add(song);
			},
			onSongDelete:function(song){
				this.songCollection.remove(song);
			},
			songListHandler:function(songList){
				this.songCollection.reset(songList);
				MusicEngine.playListRegion.show(this.playListView);
			},
			loginHandler: function(data){
				if(data.success){

				}
				else{
					alert("Can not login !");
				}
			},
			onStart: function ( options ) {

			},
			onStop: function ( options ) {

			}
		} );
		/**
		 * Register the module with application
		 */
		MusicEngine.module( "PlayerModule", PlayerModule );
	}
)( jQuery, Backbone,Backbone.Marionette, socket, MusicEngine, MusicEngine.Views, MusicEngine.Models, MusicEngine.Collections );
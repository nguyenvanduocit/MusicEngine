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
		_.extend(MusicEngine.pubsub, Backbone.Events);

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
		Models.Song = Backbone.Model.extend({});
		Collections.Song = Backbone.Collection.extend({

		});

		Collections.Song.comparator = function(model) {
			return model.get('score');
		};

		Views.Song  = Marionate.ItemView.extend({
			template: "#songItem-template",
		});
		/**
		 * Player
		 */
		var playerRegion = Marionate.Region.extend({

		});
		Views.Player = Marionette.ItemView.extend({
			events:{
				'ended audio#player':'onEnd'
			},
			template:'#player-template',
			initialize:function(options){
				_.extend( this.options, options );
				this.model = new Models.Song();
				this.listenTo(MusicEngine.pubsub,'song.play', this.playSong);
				this.player = null;
			},
			onEnd:function(){
				MusicEngine.pubsub.trigger('player.song.end', {songId:this.model.get('id')});
			},
			onDuration:function(duration){
				var player = duration.currentTarget;
				var time = player.currentTime;
				var mins=Math.floor(time/60);
				var secs=Math.floor(time-mins * 60);
				var hrs=Math.floor(time / 3600);
				var duration_formated = (hrs>9?hrs:"0"+hrs) + ":" + (mins>9?mins:"0"+mins) + ":" + (secs>9?secs:"0"+secs);
				MusicEngine.pubsub.trigger('player.duration', {duration:duration_formated, songId:this.model.get('id')});
			},
			onRender: function(){
				var self = this;
				var player = this.$el.find('#player' ).first();
				if(player.length > 0){
					this.player = player[0];
					this.player.onended = function(e){
						self.onEnd(e);
					};
					this.player.ontimeupdate = function(e){
						self.onDuration(e)
					};
				}
			},
			playSong:function(song){
				this.model.set(song);
				this.player.src=song.url;
				this.player.play();
			}
		});
		/**
		 * Playlist
		 */
		var playListRegion = Marionate.Region.extend({
		});
		Views.PlayList =  Marionette.CollectionView.extend({

			template: "#playlist-template",
			childView: Views.Song,
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
				this.playerView = new Views.Player();
				this.initViewEvent();
				this.initSocketEvent();
				this.initRegion();
				this.login();
				this.startPlay();
			},
			initViewEvent:function(){
				this.listenTo(MusicEngine.pubsub,'player.duration', this.updateDuration);
				this.listenTo(MusicEngine.pubsub,'player.song.end', this.onPlayerEnd);
			},
			onPlayerEnd:function(data){
				var info  ={
					songId:data.songId
				};
				socket.emit('player.song.end', info);
			},
			updateDuration:function(data){
				var durationInfo = {
					duration:data.duration,
					songId:data.songId
				};
				socket.emit('player.duration', durationInfo);
			},
			initSocketEvent : function(){

				var self = this;

				socket.on('player.login.result', function(data){
					MusicEngine.pubsub.trigger('player.login.result', data);
					self.loginHandler(data);
				});
				socket.on('playlist.songList', function(data){
					MusicEngine.pubsub.trigger('playlist.songList', data);
					self.songListHandler(data);
				});
				socket.on('song.add', function(data){
					MusicEngine.pubsub.trigger('song.add', data);
					self.onSongAdd(data);
				});
				socket.on('song.delete', function(data){
					MusicEngine.pubsub.trigger('song.delete', data);
					self.onSongDelete(data);
				});
				socket.on('song.play', function(data){
					console.log(data);
					MusicEngine.pubsub.trigger('song.play', data);
				});
				socket.on('song.remove', function(data){
					MusicEngine.pubsub.trigger('song.remove', data);
					self.onSongDelete(data);
				});
				socket.on('song.nomore', function(data){
					MusicEngine.pubsub.trigger('song.nomore', data);
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
					},
					playerRegion: {
						el: '#playerRegion',
						regionClass: playerRegion
					}
				});
			},
			startPlay:function(){
				socket.emit('song.nextSong');
			},
			onSongAdd: function(song){
				this.songCollection.add(song);
			},
			onSongDelete:function(data){
				this.songCollection.remove(data.songId);
			},
			songListHandler:function(songList){
				this.songCollection.reset(songList);
				MusicEngine.playListRegion.show(this.playListView);
				MusicEngine.playerRegion.show(this.playerView);
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
/**
 * Module
 */
(
	function ( $, Backbone, Marionate, socket, MusicEngine, Views, Models, Collections ) {
		/**
		 * Message list
		 */
		var messageRegion = Marionate.Region.extend( {} );
		/**
		 * Playlist
		 */
		var playListRegion = Marionate.Region.extend( {} );
		/**
		 * Player
		 */
		var playerRegion = Marionate.Region.extend( {} );
		Views.Player = Marionette.CompositeView.extend( {
			events: {
				'ended audio#player': 'onEnd'
			},
			onShow: function () {
				socket.emit( 'player.stage', {stage: 'firstLoad', volume:this.player.volume} );
			},
			template: '#player-template',
			initialize: function ( options ) {
				_.extend( this.options, options );
				this.model = new Models.Song();
				this.player = null;
				this.currentDuration = '';
				this.listenTo( MusicEngine.pubsub, 'player.play', this.onPlaySong );
				this.listenTo( MusicEngine.pubsub, 'playlist.empty', this.onPlaylistEmpty );
				this.listenTo( MusicEngine.pubsub, 'player.control.volume', this.onChangeVolumeRequest );
			},
			onSongEnd: function ( e ) {
				socket.emit( 'player.stage', {
					stage: 'end',
					song: this.model.toJSON()
				} );
			},
			onDuration: function ( duration ) {
				var player = duration.currentTarget;
				var time = player.currentTime;
				var mins = Math.floor( time / 60 );
				var secs = Math.floor( time - mins * 60 );
				var hrs = Math.floor( time / 3600 );
				var duration_formated = (
					                        hrs > 9 ? hrs : "0" + hrs
				                        ) + ":" + (
					                        mins > 9 ? mins : "0" + mins
				                        ) + ":" + (
					                        secs > 9 ? secs : "0" + secs
				                        );
				if ( this.currentDuration !== duration_formated ) {
					this.currentDuration = duration_formated;
					socket.emit( 'player.stage', {
						stage: 'playing',
						song: this.model.toJSON(),
						duration: duration_formated
					} );
				}
			},
			onPause  :function(){
				socket.emit( 'player.stage', {
					stage: 'pause',
					song: this.model.toJSON()
				} );
			},
			onVolumechange:function(e){
				socket.emit( 'player.volumeChange', {
					volume: this.player.volume
				} );
			},
			onChangeVolumeRequest:function(data){
				try{
					this.player.volume = data.value;
				}
				catch(e){
					console.log(e);
				}
			},
			onRender: function () {
				var self = this;
				var player = this.$el.find( '#player' ).first();
				if ( player.length > 0 ) {
					this.player = player[ 0 ];
					this.player.onended = function ( e ) {
						self.onSongEnd( e );
					};
					this.player.ontimeupdate = function ( e ) {
						self.onDuration( e )
					};
					this.player.onpause = function ( e ) {
						self.onPause( e )
					};
					this.player.onvolumechange = function ( e ) {
						self.onVolumechange( e )
					};
				}
			},
			onPlaySong: function ( song ) {
				try {
					this.model.set( song );
					this.player.src = song.url;
					this.player.play();
				} catch ( e ) {
					console.log( e.message );
				}
			},
			onPlaylistEmpty:function(data){
				this.model.clear();
				this.player.src = '';
			}
		} );
		/**
		 * Define the module
		 */
		var RoomModule = Marionette.Module.extend( {
			initialize: function ( options, moduleName, app ) {
				_.extend( this.options, options );

				this.songCollection = new Collections.Song();
				this.messageCollection = new Collections.Message();

				this.messageListView = new Views.MessageListView( {
					collection: this.messageCollection
				} );
				this.playListView = new Views.PlayList( {
					collection: this.songCollection
				} );
				this.playerView = new Views.Player();
				this.initViewEvent();
				this.initSocketEvent();
				this.initRegion();
			},
			initViewEvent: function () {
				this.listenTo( MusicEngine.pubsub, 'client.init.result', this.onInitResult );
				this.listenTo( MusicEngine.pubsub, 'client.login.result', this.onLoginResult );
				this.listenTo( MusicEngine.pubsub, 'client.disconnect', this.onDisconnect );

				this.listenTo( MusicEngine.pubsub, 'message.recive', this.onMessageRecived );

				this.listenTo( MusicEngine.pubsub, 'song.add', this.onSongAdded );
				this.listenTo( MusicEngine.pubsub, 'song.remove', this.onSongRemoved );
				this.listenTo( MusicEngine.pubsub, 'playlist.fetch.result', this.onPlaylistFetchResult );
			},
			initSocketEvent: function () {
				var self = this;
				socket.on( 'client.init.result', function ( data ) {
					MusicEngine.pubsub.trigger( 'client.init.result', data );
				} );
				socket.on( 'client.login.result', function ( data ) {
					MusicEngine.pubsub.trigger( 'client.login.result', data );
				} );

				socket.on( 'playlist.fetch.result', function ( data ) {
					MusicEngine.pubsub.trigger( 'playlist.fetch.result', data );
				} );

				socket.on( 'song.add', function ( data ) {
					MusicEngine.pubsub.trigger( 'song.add', data );
				} );
				socket.on( 'song.remove', function ( songId ) {
					MusicEngine.pubsub.trigger( 'song.remove', songId );
				} );

				socket.on( 'player.currentPlaying.result', function ( song ) {
					MusicEngine.pubsub.trigger( 'player.currentPlaying.result', song );
				} );

				socket.on( 'player.play', function ( song ) {
					MusicEngine.pubsub.trigger( 'player.play', song );
				} );

				socket.on( 'player.stop', function ( song ) {
					MusicEngine.pubsub.trigger( 'player.stop', song );
				} );
				socket.on( 'playlist.empty', function ( data ) {
					MusicEngine.pubsub.trigger( 'playlist.empty', data );
				} );
				socket.on( 'player.control.volume', function ( data ) {
					MusicEngine.pubsub.trigger( 'player.control.volume', data );
				} );
			},
			onDisconnect: function () {
				console.log( 'Your are disconnected' );
				MusicEngine.playListRegion.empty();
				MusicEngine.mesasgeRegion.empty();
				MusicEngine.playerRegion.empty();
			},
			onPlaylistFetchResult: function ( playlist ) {
				this.songCollection.reset( playlist );
			},
			onSongAdded: function ( song ) {
				try {
					var newSong = new MusicEngine.Models.Song( song );
					this.songCollection.add( newSong );
				}
				catch ( e ) {
					console.log( e.message );
				}
			},
			onSongRemoved: function ( songId ) {
				try {
					this.songCollection.remove( songId );
				}
				catch ( e ) {
					console.log( e.message );
				}
			},
			onMessageRecived: function ( data ) {
				try {
					var newMessage = this.messageCollection.findWhere( {id: data.id} );
					if ( newMessage ) {
						/**
						 * This message is exist, update it
						 */
						newMessage.set( data );
					}
					else {
						newMessage = new Models.Message( data );
						this.messageCollection.add( newMessage );
					}
				} catch ( e ) {
					console.log( e );
				}
			},
			onLoginResult: function ( data ) {
				console.log( data );
				if ( data.success ) {
					MusicEngine.playListRegion.show( this.playListView );
					MusicEngine.mesasgeRegion.show( this.messageListView );
					MusicEngine.playerRegion.show( this.playerView );
				}
				else {
					alert( 'Login is not successed' );
				}
			},
			onInitResult: function ( data ) {
				if ( data.isAllowed ) {
					/**
					 * Login success
					 */
					socket.emit( 'client.login', {username: 'player',type:'player', room: MusicEngine.roomId} );
				}
				else {
					alert( 'You are not allowed : ' + data.msg );
				}
			},
			initRegion: function () {
				MusicEngine.addRegions( {
					playListRegion: {
						el: '#playListRegion',
						regionClass: playListRegion
					},
					mesasgeRegion: {
						el: '#messageRegion',
						regionClass: messageRegion
					},
					playerRegion: {
						el: '#playerRegion',
						regionClass: playerRegion
					}
				} );
			},
			onStart: function ( options ) {
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
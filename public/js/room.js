/**
 * Module
 */
(
	function ( $, Backbone, Marionate, socket, MusicEngine, Views, Models, Collections ) {
		/**
		 * Current playin
		 */
		var currentPlayingRegion = Marionate.Region.extend( {} );
		Views.currentPlayingView = Marionette.CompositeView.extend( {
			template: "#currentPlaying-template",
			events: {
				'click .vote': 'onVoteRequest'
			},
			initialize: function ( options ) {
				_.extend( this.options, options );

				this.currentSongId = 0;
				this.durationEl = null;
				this.containerEl = null;
				this.currentEl = null;
				this.titleEl = null;
				this.voteCountEl = null;
				this.backgroundEl = null;
				this.currentStage = 'noplayer'; //playing | noplayer | nosong
				this.listenTo( MusicEngine.pubsub, 'song.playing', this.onSongPlaying );
				this.listenTo( MusicEngine.pubsub, 'song.pause', this.onSongPaused );
				this.listenTo( MusicEngine.pubsub, 'vote.change', this.onVoteChange );
				this.listenTo( MusicEngine.pubsub, 'player.play', this.onPlayerPlay );
				this.listenTo( MusicEngine.pubsub, 'player.connect', this.onPlayerConnect );
				this.listenTo( MusicEngine.pubsub, 'player.disconnect', this.onPlayerDisconnect );
				this.listenTo( MusicEngine.pubsub, 'playlist.empty', this.onPlaylistEmpty );
				this.listenTo( MusicEngine.pubsub, 'player.info.result', this.onPlayerInfoResult );
			},
			onShow:function(){
				socket.emit('player.info');
			},
			onPlayerInfoResult:function(data){
				if(data.isConnected){
					this.updateView('playerconnected');
				}
			},
			onVoteRequest: function ( e ) {
				e.preventDefault();
				socket.emit( 'vote', {action: 'next'} );
			},
			onVoteChange: function ( data ) {
			},
			onPlayerPlay: function ( data ) {
				this.updateView( 'playing' );
			},
			onPlaylistEmpty: function ( data ) {
				this.updateView( 'nosong' );
			},
			onRender: function () {
				this.containerEl = this.$el.find( '#currentPlayingContainer' );
				this.currentEl = this.$el.find( '#currentPlaying' );
				this.durationEl = this.currentEl.find( '.duration' );
				this.titleEl = this.currentEl.find( '.title' );
				this.voteCountEl = this.currentEl.find( '.voteCount' );
				this.backgroundEl = this.currentEl.find( '.backgroundImage' );
			},
			onPlayerDisconnect:function(){
				this.updateView( 'noplayer' );
			},
			onPlayerConnect:function(){
				this.updateView( 'playerconnected' );
			},
			onSongPlaying: function ( data ) {
				this.updateInfo( data );
			},
			onSongPaused: function ( data ) {
			},
			updateView: function ( stage ) {
				if ( this.currentStage != stage ) {
					this.currentStage = stage;
					this.containerEl.attr('class', stage);
				}
			},
			updateInfo: function ( data ) {
				this.updateView( 'playing' );
				if ( this.currentSongId != data.song.id ) {
					this.currentSongId = data.song.id;
					this.titleEl.text( data.song.name  + ' - ' + data.song.performer);
					this.backgroundEl.attr( 'src', data.song.image );
				}
				if ( this.durationEl ) {
					this.durationEl.text( data.duration );
				}
			},
		} );
		/**
		 * Song submit Regon
		 */
		var songSubmitRegion = Marionate.Region.extend( {} );
		Views.songSubmitView = Marionette.CompositeView.extend( {
			template: "#songsubmit-template",
			events: {
				'submit #songSubmitForm': 'onSubmit'
			},
			initialize: function ( options ) {
				_.extend( this.options, options );
			},
			onSubmit: function ( e ) {
				e.preventDefault();
				var $target = $( e.currentTarget );
				var $urlInput = $target.find( 'input[name="url"]' );
				var $urlLabel = $target.find( 'label' );
				$urlLabel.removeClass('active');
				var url = $urlInput.val();
				$urlInput.val( '' );
				socket.emit( 'song.submit', {url: url} );
			}
		} );
		var controlerRegion = Marionate.Region.extend( {} );

		Views.ControlerView = Marionette.CompositeView.extend( {
			template: "#controler-template",
			events:{
				'change #volume_control':'onChangeVolume'
			},
			onRender: function () {
				this.volumeControl = this.$el.find( '#volume_control' );
			},
			initialize: function () {
				this.listenTo( MusicEngine.pubsub, 'player.volumeChange', this.onVolumeChanged );
				this.listenTo( MusicEngine.pubsub, 'player.info.result', this.onVolumeChanged );
			},
			onVolumeChanged: function ( data ) {
				if(data.isConnected) {
					this.volumeControl.val( data.volume );
				}
			},
			onChangeVolume:function(e){
				var val = $(e.currentTarget).val();
				console.log(val);
				socket.emit('vote', {action:'volume',value:val});
			}
		} );
		/**
		 * Login
		 */
		var loginRegion = Marionate.Region.extend( {} );

		Views.LoginForm = Marionette.CompositeView.extend( {
			template: "#login-template",
			events: {
				'submit #loginForm': 'onSubmit'
			},

			onSubmit: function ( e ) {
				e.preventDefault();
				var $target = $( e.currentTarget );

				var $userNameInput = $target.find( 'input[name="username"]' );
				var username = $userNameInput.val();
				socket.emit( 'client.login', {username: username, room: MusicEngine.roomId} );
			}

		} );
		/**
		 * Message list
		 */
		var messageRegion = Marionate.Region.extend( {} );

		/**
		 * Playlist
		 */
		var playListRegion = Marionate.Region.extend( {} );

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
				this.loginView = new Views.LoginForm();
				this.songSubmitView = new Views.songSubmitView();
				this.controlerView = new Views.ControlerView();
				this.currentPlayingView = new Views.currentPlayingView();

				this.initViewEvent();
				this.initSocketEvent();
				this.initRegion();
			},
			initViewEvent: function () {
				this.listenTo( MusicEngine.pubsub, 'client.init.result', this.onInitResult );
				this.listenTo( MusicEngine.pubsub, 'client.login.result', this.onLoginResult );
				this.listenTo( MusicEngine.pubsub, 'song.submit.result', this.onSongSubmitResult );
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

				socket.on( 'song.submit.result', function ( data ) {
					MusicEngine.pubsub.trigger( 'song.submit.result', data );
				} );
				socket.on( 'song.add', function ( data ) {
					MusicEngine.pubsub.trigger( 'song.add', data );
				} );
				socket.on( 'song.remove', function ( data ) {
					MusicEngine.pubsub.trigger( 'song.remove', data );
				} );
				socket.on( 'song.playing', function ( data ) {
					MusicEngine.pubsub.trigger( 'song.playing', data );
				} );
				socket.on( 'song.pause', function ( data ) {
					MusicEngine.pubsub.trigger( 'song.pause', data );
				} );
				socket.on( 'player.volumeChange', function ( data ) {
					MusicEngine.pubsub.trigger( 'player.volumeChange', data );
				} );
				socket.on( 'message.recive', function ( data ) {
					MusicEngine.pubsub.trigger( 'message.recive', data );
				} );
				socket.on( 'player.play', function ( data ) {
					MusicEngine.pubsub.trigger( 'player.play', data );
				} );
				socket.on( 'player.disconnect', function ( data ) {
					MusicEngine.pubsub.trigger( 'player.disconnect', data );
				} );
				socket.on( 'player.connect', function ( data ) {
					MusicEngine.pubsub.trigger( 'player.connect', data );
				} );
				socket.on( 'vote.change', function ( data ) {
					MusicEngine.pubsub.trigger( 'vote.change', data );
				} );
				socket.on( 'playlist.empty', function ( data ) {
					MusicEngine.pubsub.trigger( 'playlist.empty', data );
				} );
				socket.on( 'player.info.result', function ( data ) {
					MusicEngine.pubsub.trigger( 'player.info.result', data );
				} );
			},
			onDisconnect: function (data) {
				console.log( 'You are disconnected' );
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
			onSongSubmitResult: function ( data ) {
				MusicEngine.pubsub.trigger( 'message.recive', data );
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
						this.messageCollection.push( newMessage );
					}
				} catch ( e ) {
					console.log( e );
				}
			},
			onLoginResult: function ( data ) {
				if ( data.success ) {
					MusicEngine.loginRegion.empty();
					MusicEngine.playListRegion.show( this.playListView );
					MusicEngine.mesasgeRegion.show( this.messageListView );
					MusicEngine.songSubmitRegion.show( this.songSubmitView );
					MusicEngine.controlerRegion.show( this.controlerView );
					MusicEngine.currentPlayingRegion.show( this.currentPlayingView );
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
					MusicEngine.loginRegion.show( this.loginView );
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
					loginRegion: {
						el: '#loginRegion',
						regionClass: loginRegion
					},
					songSubmitRegion: {
						el: '#songSubmitRegion',
						regionClass: songSubmitRegion
					},
					controlerRegion: {
						el: '#controlerRegion',
						regionClass: controlerRegion
					},
					currentPlayingRegion: {
						el: '#currentPlayingRegion',
						regionClass: currentPlayingRegion
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
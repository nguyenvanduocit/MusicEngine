/**
 * Module
 */
(
	function ( $, Backbone, Marionate, socket, MusicEngine, Views, Models, Collections ) {
		Models.Member = Backbone.Model.extend( {
			defaults: {
				'username': 'un-own'
			}
		} );
		Collections.Member = Backbone.Collection.extend( {} );
		var memberListRegion = Marionate.Region.extend( {} );
		Views.MemberItem = Marionate.ItemView.extend( {
			template: "#memberItem-template",
			tagName:'ul',
			className:'collection-item',
			modelEvents: {
				'change': 'fieldsChanged'
			},

			fieldsChanged: function() {
				this.render();
			}
		} );
		Views.MemberListView = Marionette.CollectionView.extend( {
			tagName:'ul',
			className:'collection',
			childView: Views.MemberItem,
			onShow: function () {

			},
			appendHtml: function(collectionView, itemView, index){
				collectionView.$el.prepend(itemView.el);
			}

		} );
		/**
		 * Define the module
		 */
		var MemberModule = Marionette.Module.extend( {
			initialize: function ( options, moduleName, app ) {
				_.extend( this.options, options );

				this.memberCollection = new Collections.Member();
				this.memberListView = new Views.MemberListView( {
					collection: this.memberCollection
				} );

				this.initViewEvent();
				this.initSocketEvent();
				this.initRegion();
			},
			initViewEvent: function () {
				this.listenTo( MusicEngine.pubsub, 'client.login.result', this.onLoginResult );
				this.listenTo( MusicEngine.pubsub, 'member.list.fetch.result', this.onFetchMemberResult );
				this.listenTo( MusicEngine.pubsub, 'client.connect', this.onClientConnected );
				this.listenTo( MusicEngine.pubsub, 'client.leave', this.onClientDisconnected );
			},
			onClientConnected:function(data){
				console.log(data);
				try {
					var member = new MusicEngine.Models.Member(data);
					this.memberCollection.add( member );
				}catch(e){
					console.log( e.message);
				}
			},
			onClientDisconnected:function(data){
				try {
					this.memberCollection.remove( {id:data.id} );
				}catch(e){
					console.log( e.message);
				}
			},
			onFetchMemberResult:function(data){
				try {
					var members = data.members;
					this.memberCollection.reset( members );
				}
				catch(e){
					console.log(e);
				}
			},
			onLoginResult:function(data){
				if(data.success){
					MusicEngine.memberListRegion.show( this.memberListView );
				}
				socket.emit('member.list.fetch');
			},
			initSocketEvent: function () {
				socket.on( 'member.list.fetch.result', function ( data ) {
					MusicEngine.pubsub.trigger( 'member.list.fetch.result', data );
				} );
				socket.on( 'client.connect', function ( data ) {
					MusicEngine.pubsub.trigger( 'client.connect', data );
				} );
				socket.on( 'client.leave', function ( data ) {
					MusicEngine.pubsub.trigger( 'client.leave', data );
				} );
			},
			initRegion: function () {
				MusicEngine.addRegions( {
					memberListRegion: {
						el: '#memberListRegion',
						regionClass: memberListRegion
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
		MusicEngine.module( "MemberModule", MemberModule );
	}
)( jQuery, Backbone, Backbone.Marionette, socket, MusicEngine, MusicEngine.Views, MusicEngine.Models, MusicEngine.Collections );
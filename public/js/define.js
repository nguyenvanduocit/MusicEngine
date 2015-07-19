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
			MusicEngine.roomId = Number( window.location.pathname.match( /\/(.*)\/(\d+)$/ )[2] );
			MusicEngine.isReconnect = false;
			MusicEngine.on( 'start', function () {
				Backbone.history.start();
				socket.emit( 'client.init', {room: MusicEngine.roomId, type: 'member'} );
			} );

			socket.on( 'connect', function () {
				if(!MusicEngine.isReconnect) {
					MusicEngine.start();
				}
			} );
			socket.on( 'disconnect', function () {
				MusicEngine.isReconnect = true;
				MusicEngine.pubsub.trigger('client.disconnect');
			} );
		} );
	}
)( jQuery, Backbone, Backbone.Marionette, socket, MusicEngine );
/**
 * Module
 */
(
	function ( $, Backbone, Marionate, socket, MusicEngine, Views, Models, Collections ) {
		Models.Song = Backbone.Model.extend( {
			defaults: {
				'own': 'un-own',
				'url': 'un-url',
				'name': 'un-name',
				'performer': 'un-name',
				'image': '',
				'score': 0
			}
		} );
		Collections.Song = Backbone.Collection.extend( {} );
		Models.Message = Backbone.Model.extend( {
			defaults: {
				'username': 'un-own',
				'msg': 'un-url'
			}
		} );
		Collections.Message = Backbone.Collection.extend( {} );
		Views.SongItem = Marionate.ItemView.extend( {
			tagName:'li',
			className:'collection-item avatar',
			template: "#songItem-template",
			modelEvents: {
				'change': 'fieldsChanged'
			},
			fieldsChanged: function() {
				this.render();
			}
		} );
		Views.ListViewEmpty = Marionette.ItemView.extend({
			template: "#listViewEmpty-template"
		});
		Views.PlayList = Marionette.CollectionView.extend( {
			tagName:'ul',
			className:'collection',
			emptyView:Views.ListViewEmpty,
			childView: Views.SongItem,
			onShow: function () {
				socket.emit('playlist.fetch');
			}
		} );

		Views.MessageItem = Marionate.ItemView.extend( {
			template: "#messageItem-template",
			tagName:'ul',
			className:'collection-item',
			modelEvents: {
				'change': 'fieldsChanged'
			},

			fieldsChanged: function() {
				this.render();
			}
		} );
		Views.MessageListView = Marionette.CollectionView.extend( {
			tagName:'ul',
			className:'collection',
			childView: Views.MessageItem,
			onShow: function () {

			},
			appendHtml: function(collectionView, itemView, index){
				collectionView.$el.prepend(itemView.el);
			}

		} );
	}
)( jQuery, Backbone, Backbone.Marionette, socket, MusicEngine, MusicEngine.Views, MusicEngine.Models, MusicEngine.Collections );
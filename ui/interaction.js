/*!
 * jQuery UI Droppable @VERSION
 * http://jqueryui.com
 *
 * Copyright 2014 jQuery Foundation and other contributors
 * Released under the MIT license.
 * http://jquery.org/license
 *
 * http://api.jqueryui.com/droppable/
 */
(function( factory ) {
	if ( typeof define === "function" && define.amd ) {

		// AMD. Register as an anonymous module.
		define([
			"jquery",
			"./core",
			"./widget",
		], factory );
	} else {

		// Browser globals
		factory( jQuery );
	}
}(function( $ ) {

var interaction; // = $.ui.interaction

$.widget( "ui.interaction", {
	version: "@VERSION",
	_create: function() {
		for ( var hook in interaction.hooks ) {
			interaction.hooks[ hook ].setup( this, this._startProxy( hook ) );
		}
	},

	_startProxy: function( hook ) {
		var that = this;
		return function( event, position ) {
			that._interactionStart( event, position, hook );
		}
	},

	_interactionStart: function( event, position, hook ) {
		if ( false !== this._start( event, position ) ) {
			interaction.started = true;
			interaction.hooks[ hook ].handle( this );
		}
	},

	_interactionMove: function( event, position ) {
		this._move( event, position );
	},

	_interactionStop: function( event, position ) {
		this._stop( event, position );
		interaction.started = false;
	}
});

interaction = $.ui.interaction;
$.extend( interaction, {
	started: false,
	hooks: {}
});

interaction.hooks.mouse = {
	setup: function( widget, start ) {
		widget._bind({
			"mousedown": function( event ) {
				if ( event.which === 1 ) {
					event.preventDefault();
					start( event, {
						left: event.pageX,
						top: event.pageY
					});
				}
			}
		});
	},

	handle: function( widget ) {
		function mousemove( event ) {
			event.preventDefault();
			widget._interactionMove( event, {
				left: event.pageX,
				top: event.pageY
			});
		}

		function mouseup( event ) {
			widget._interactionStop( event, {
				left: event.pageX,
				top: event.pageY
			});
			widget.document
				.unbind( "mousemove", mousemove )
				.unbind( "mouseup", mouseup );
		}

		widget._bind( widget.document, {
			"mousemove": mousemove,
			"mouseup": mouseup
		});
	}
};

});

return $.ui.interaction;

}));


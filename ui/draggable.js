/*!
 * jQuery UI Draggable @VERSION
 * http://jqueryui.com
 *
 * Copyright 2014 jQuery Foundation and other contributors
 * Released under the MIT license.
 * http://jquery.org/license
 *
 * http://api.jqueryui.com/draggable/
 *
 * Depends:
 *	jquery.ui.core.js
 *	jquery.ui.interaction.js
 *	jquery.ui.widget.js
 */
(function( factory ) {
  if ( typeof define === "function" && define.amd ) {

    // AMD. Register as an anonymous module.
    define([
      "jquery",
      "./core",
      "./widget"
    ], factory );
  } else {

    // Browser globals
    factory( jQuery );
  }
}(function( $ ) {

// create a shallow copy of an object
function copy( obj ) {
	var prop,
		ret = {};
	for ( prop in obj ) {
		ret[ prop ] = obj[ prop ];
	}
	return ret;
}

$.widget( "ui.draggable", $.ui.interaction, {
	version: "@VERSION",
	widgetEventPrefix: "drag",

	options: {
		appendTo: null,
		exclude: "input,textarea,button,select,option",
		handle: null,
		helper: false
	},

	// dragEl: element being dragged (original or helper)
	// position: final CSS position of dragEl
	// offset: offset of dragEl
	// originalPosition: CSS position before drag start
	// originalOffset: offset before drag start
	// originalPointer: pageX/Y at drag start (offset of pointer)
	// startPosition: CSS position at drag start (after beforeStart)
	// startOffset: offset at drag start (after beforeStart)
	// tempPosition: overridable CSS position of dragEl
	// overflowOffset: offset of scroll parent
	// overflow: object containing width and height keys of scroll parent
	// domPosition: object containing original parent and index when using
	// appendTo option without a helper

	_create: function() {
		this._super();

		this.scrollSensitivity = 20;
		this.scrollSpeed = 5;

		// Static position elements can't be moved with top/left
		if ( this.element.css( "position" ) === "static" ) {
			this.element.css( "position", "relative" );
		}

		this.element.addClass( "ui-draggable" );
	},

	/** interaction interface **/

	_isValidTarget: function( element ) {
		var handle = this.options.handle ? element.is( this.options.handle ) : true,
			exclude = this.options.exclude ? element.is( this.options.exclude ) : false;

		return ( handle && !exclude );
	},

	_start: function( event, pointerPosition ) {
		var offset;

		// The actual dragging element, should always be a jQuery object
		this.dragEl = ( this.options.helper === true || typeof this.options.helper === 'function' ) ?
			this._createHelper( pointerPosition ) :
			this.element;

		// _createHelper() ensures that helpers are in the correct position
		// in the DOM, but we need to handle appendTo when there is no helper
		if ( this.options.appendTo && this.dragEl === this.element ) {
			this.domPosition = {
				parent: this.element.parent(),
				index: this.element.index()
			};
			offset = this.dragEl.offset();
			this.dragEl
				.appendTo( this._appendToEl() )
				.offset( offset );
		}

		this.cssPosition = this.dragEl.css( "position" );
		this.scrollParent = this.element.scrollParent();

		// Cache starting positions
		this.originalPosition = this.startPosition = this._getPosition();
		this.originalOffset = this.startOffset = this.dragEl.offset();
		this.originalPointer = pointerPosition;

		// Cache current position and offset
		this.position = copy( this.startPosition );
		this.offset = copy( this.startOffset );

		// Cache the offset of scrollParent, if required for _handleScrolling
		if ( this.scrollParent[0] !== this.document[0] && this.scrollParent[0].tagName !== "HTML" ) {
			this.overflowOffset = this.scrollParent.offset();
		}

		this.overflow = {
			height: this.scrollParent[0] === this.document[0] ?
				this.window.height() : this.scrollParent.height(),
			width: this.scrollParent[0] === this.document[0] ?
				this.window.width() : this.scrollParent.width()
		};

		this._preparePosition( pointerPosition );

		// If user cancels beforeStart, don't allow dragging
		if ( this._trigger( "beforeStart", event,
				this._originalHash( pointerPosition ) ) === false ) {

			// domPosition needs to be undone even if beforeStart is stopped
			// Otherwise this.dragEl will remain in the element appendTo is set to
			this._resetDomPosition();
			return false;

		}

		this._setCss();
		this.startPosition = this._getPosition();
		this.startOffset = this.dragEl.offset();

		this._trigger( "start", event, this._fullHash( pointerPosition ) );
		this._blockFrames();
	},

	_resetDomPosition: function() {

		// Nothing to do in this case
		if ( !this.domPosition ) {
			return;
		}

		var parent = this.domPosition.parent,
			next = parent.children().eq( this.domPosition.index );
		if ( next.length ) {
			next.before( this.element );
		} else {
			parent.append( this.element );
		}
		this.element.offset( this.offset );
		this.domPosition = null;

	},

	_move: function( event, pointerPosition ) {
		this._preparePosition( pointerPosition );

		// If user cancels drag, don't move the element
		if ( this._trigger( "drag", event, this._fullHash( pointerPosition ) ) === false ) {
			return;
		}

		this._setCss();

		// Scroll the scrollParent, if needed
		this._handleScrolling( pointerPosition );
	},

	_stop: function( event, pointerPosition ) {
		this._preparePosition( pointerPosition );

		// If user cancels stop, leave helper there
		if ( this._trigger( "stop", event, this._fullHash( pointerPosition ) ) !== false ) {
			if ( this.options.helper ) {
				this.dragEl.remove();
			}
			this._resetDomPosition();
		}

		this._unblockFrames();
	},

	/** internal **/

	_createHelper: function( pointerPosition ) {
		var helper,
			offset = this.element.offset(),
			xPos = (pointerPosition.x - offset.left) / this.element.outerWidth(),
			yPos = (pointerPosition.y - offset.top) / this.element.outerHeight();

		// clone
		if ( this.options.helper === true ) {
			helper = this.element.clone()
				.removeAttr( "id" )
				.find( "[id]" )
					.removeAttr( "id" )
				.end();
		} else {
			// TODO: figure out the signature for this; see #4957
			helper = $( this.options.helper() );
		}

		// Ensure the helper is in the DOM; obey the appendTo option if it exists
		if ( this.options.appendTo || !helper.closest( "body" ).length ) {
			helper.appendTo( this._appendToEl() || this.document[0].body );
		}

		return helper
			// Helper must be absolute to function properly
			.css( "position", "absolute" )
			.offset({
				left: pointerPosition.x - helper.outerWidth() * xPos,
				top: pointerPosition.y - helper.outerHeight() * yPos
			});
	},

	// TODO: Remove after 2.0, only used for backCompat
	_appendToEl: function() {
		return this.options.appendTo;
	},

	_getPosition: function() {
		var left, top, position,
			scrollTop = this.scrollParent.scrollTop(),
			scrollLeft = this.scrollParent.scrollLeft();

		// If fixed or absolute
		if ( this.cssPosition !== "relative" ) {
			position = this.dragEl.position();

			// Take into account scrollbar
			position.top -= scrollTop;
			position.left -= scrollLeft;

			return position;
		}

		// When using relative, css values are checked
		// Otherwise the position wouldn't account for padding on ancestors
		left = this.dragEl.css( "left" );
		top = this.dragEl.css( "top" );

		// Webkit will give back auto if there is no explicit value
		left = ( left === "auto" ) ? 0: parseInt( left, 10 );
		top = ( top === "auto" ) ? 0: parseInt( top, 10 );

		return {
			left: left - scrollLeft,
			top: top - scrollTop
		};
	},

	_handleScrolling: function( pointerPosition ) {
		var scrollTop = this.scrollParent.scrollTop(),
			scrollLeft = this.scrollParent.scrollLeft(),
			scrollSensitivity = this.scrollSensitivity,
			// overflowOffset is only set when scrollParent is not doc/html
			overflowLeft = this.overflowOffset ?
				this.overflowOffset.left :
				scrollLeft,
			overflowTop = this.overflowOffset ?
				this.overflowOffset.top :
				scrollTop,
			xRight = this.overflow.width + overflowLeft - pointerPosition.x,
			xLeft = pointerPosition.x- overflowLeft,
			yBottom = this.overflow.height + overflowTop - pointerPosition.y,
			yTop = pointerPosition.y - overflowTop;

		// Handle vertical scrolling
		if ( yBottom < scrollSensitivity ) {
			this.scrollParent.scrollTop( scrollTop +
				this._speed( scrollSensitivity - yBottom ) );
		} else if ( yTop < scrollSensitivity ) {
			this.scrollParent.scrollTop( scrollTop -
				this._speed( scrollSensitivity - yTop ) );
		}

		// Handle horizontal scrolling
		if ( xRight < scrollSensitivity ) {
			this.scrollParent.scrollLeft( scrollLeft +
				this._speed( scrollSensitivity - xRight ) );
		} else if ( xLeft < scrollSensitivity ) {
			this.scrollParent.scrollLeft( scrollLeft -
				this._speed( scrollSensitivity - xLeft ) );
		}
	},

	_speed: function( distance ) {
		return this.scrollSpeed + Math.round( distance / 2 );
	},

	// Uses event to determine new position of draggable, before any override from callbacks
	// TODO: handle absolute element inside relative parent like a relative element
	_preparePosition: function( pointerPosition ) {
		var leftDiff = pointerPosition.x - this.originalPointer.x,
			topDiff = pointerPosition.y - this.originalPointer.y,
			newLeft = leftDiff + this.startPosition.left,
			newTop = topDiff + this.startPosition.top;

		// Save off new values for .css() in various callbacks using this function
		this.position = {
			left: newLeft,
			top: newTop
		};

		// Save off values to compare user override against automatic coordinates
		this.tempPosition = {
			left: newLeft,
			top: newTop
		};

		// Refresh offset cache with new positions
		this.offset.left = this.startOffset.left + leftDiff;
		this.offset.top = this.startOffset.top + topDiff;
	},

	// Places draggable where event, or user via event/callback, indicates
	_setCss: function() {
		var newLeft = this.position.left,
			newTop = this.position.top;

		// User overriding left/top so shortcut math is no longer valid
		if ( this.tempPosition.left !== this.position.left ||
				this.tempPosition.top !== this.position.top ) {
			// Reset offset based on difference of expected and overridden values
			this.offset.left += newLeft - this.tempPosition.left;
			this.offset.top += newTop - this.tempPosition.top;
		}

		// TODO: does this work with nested scrollable parents?
		if ( this.cssPosition !== "fixed" ) {
			newLeft += this.scrollParent.scrollLeft();
			newTop += this.scrollParent.scrollTop();
		}

		this.dragEl.css({
			left: newLeft,
			top: newTop
		});
	},

	_originalHash: function( pointerPosition ) {
		var ret = {
			position: this.position,
			offset: copy( this.offset ),
			pointer: copy( pointerPosition )
		};

		if ( this.options.helper ) {
			ret.helper = this.dragEl;
		}

		return ret;
	},

	_fullHash: function( pointerPosition ) {
		return $.extend( this._originalHash( pointerPosition ), {
			originalPosition: copy( this.originalPosition ),
			originalOffset: copy( this.originalOffset ),
			originalPointer: copy( this.originalPointer )
		});
	},

	_blockFrames: function() {

		this.iframeBlocks = this.document.find( "iframe" ).map(function() {
			var iframe = $( this ),
				iframeOffset = iframe.offset();

			return $( "<div>" )
				.css({
					position: "absolute",
					width: iframe.outerWidth(),
					height: iframe.outerHeight(),
					top: iframeOffset.top,
					left: iframeOffset.left
				})
				.appendTo( iframe.parent() )[0];
		});
	},

	_unblockFrames: function() {
		if ( this.iframeBlocks ) {
			this.iframeBlocks.remove();
			delete this.iframeBlocks;
		}
	},

	_destroy: function() {
		this.element.removeClass( "ui-draggable" );
		this._super();
	}
});

$.widget( "ui.draggable", $.ui.draggable, {
	// $.widget doesn't know how to handle redefinitions with a custom prefix
	// custom prefixes are going away anyway, so it's not worth fixing right now
	widgetEventPrefix: "drag",

	options: {
		containment: null
	},

	_create: function() {
		this._super();
		this._bind({
			dragstart: "_setContainment",
			drag: "_contain"
		});
	},

	_setContainment: function( event, ui ) {
		var offset, left, top,
			container = this._getContainer();

		if ( !container ) {
			this.containment = null;
			return;
		}

		offset = container.offset();
		left = offset.left +
			(parseFloat( $.curCSS( container[0], "borderLeftWidth", true ) ) || 0) +
			(parseFloat( $.curCSS( container[0], "paddingLeft", true ) ) || 0);
		top = offset.top +
			(parseFloat( $.curCSS( container[0], "borderTopWidth", true ) ) || 0) +
			(parseFloat( $.curCSS( container[0], "paddingTop", true ) ) || 0);

		this.containment = {
			left: left,
			top: top,
			right: left + container.width(),
			bottom: top + container.height(),
			leftDiff: ui.originalOffset.left - ui.originalPosition.left,
			topDiff: ui.originalOffset.top - ui.originalPosition.top,
			width: this.dragEl.outerWidth(),
			height: this.dragEl.outerHeight()
		};
	},

	_contain: function( event, ui ) {
		var containment = this.containment;

		if ( !containment ) {
			return;
		}

		ui.position.left = Math.max( ui.position.left,
			containment.left - containment.leftDiff );
		ui.position.left = Math.min( ui.position.left,
			containment.right - containment.width - containment.leftDiff );

		ui.position.top = Math.max( ui.position.top,
			containment.top - containment.topDiff );
		ui.position.top = Math.min( ui.position.top,
			containment.bottom - containment.height - containment.topDiff );
	},

	_getContainer: function() {
		var container,
			containment = this.options.containment;

		if ( !containment ) {
			container = null;
		} else if ( containment === "parent" ) {
			container = this.element.parent();
		} else {
			container = $( containment );
			if ( !container.length ) {
				container = null;
			}
		}

		return container;
	}
});

// DEPRECATED
if ( $.uiBackCompat !== false ) {

	// appendTo 'parent' value
	$.widget( "ui.draggable", $.ui.draggable, {

		_appendToEl: function() {
		
			var el = this.options.appendTo;
			
			if ( el === 'parent' ) {
				el = this.dragEl.parent();
			}
		
			return el;
		
		}

	});
	
	// helper 'original' or 'clone' value
	$.widget( "ui.draggable", $.ui.draggable, {

		_create: function() {

			this._super();
			
			if ( this.options.helper === 'original' ) {
				this.options.helper = false;
			}

			if ( this.options.helper === 'clone' ) {
				this.options.helper = true;
			}

		},

		_setOption: function( key, value ) {

			if ( key !== 'helper' ) {
				return this._super( key, value );
			}
			
			if ( value === 'clone' ) {
				value = true;
			}
			
			if ( value === 'original' ) {
				value = false;
			}

			this._super( key, value );

		}

	});

	// axis option
	$.widget( "ui.draggable", $.ui.draggable, {
		options: {
			axis: false
		},

		_create: function() {

			var self = this;

			this._super();

			// On drag, make sure top does not change so axis is locked
			this.element.on( "drag", function( event, ui ) {

				if ( self.options.axis === "x" ) {
					ui.position.top = ui.originalPosition.top;
				}

				if ( self.options.axis === "y" ) {
					ui.position.left = ui.originalPosition.left;
				}

			});

		}

	});

	// cancel option
	$.widget( "ui.draggable", $.ui.draggable, {
		options: {
			cancel: null
		},

		_create: function() {

			this._super();

			if ( this.options.cancel !== null ) {
				this.options.exclude = this.options.cancel;
			}

		},

		_setOption: function( key, value ) {

			if ( key !== 'cancel' ) {
				return this._super( key, value );
			}

			this._super( key, value );
			this.options.exclude = this.options.cancel;

		}

	});

	// cursor option
	$.widget( "ui.draggable", $.ui.draggable, {
		options: {
			cursor: "auto"
		},

		_create: function() {

			var startCursor, self, body;

			this._super();

			self = this;
			body = $( this.document[0].body );

			// Cache original cursor to set back
			this.element.on( "dragbeforestart", function() {

				if ( self.options.cursor ) {
					startCursor = body[0].style.cursor;
					body.css( "cursor", self.options.cursor );
				}

			});

			// Set back cursor to whatever default was
			this.element.on( "dragstop", function() {

				if ( self.options.cursor ) {
					body.css( "cursor", startCursor );
				}

			});


		}

	});

	// cursorAt option
	$.widget( "ui.draggable", $.ui.draggable, {
		options: {
			cursorAt: false
		},

		_create: function() {

			var self = this;

			this._super();

			this.element.on( "dragbeforestart", function( event, ui ) {

				var elem = self.dragEl,
					cursorAt = self.options.cursorAt;

				// No need to continue
				if ( !cursorAt ) {
					return;
				}

				if ( "top" in cursorAt ) {
					ui.position.top += ui.pointer.y - ui.offset.top - cursorAt.top;
				}
				if ( "left" in cursorAt ) {
					ui.position.left += ui.pointer.x - ui.offset.left - cursorAt.left;
				}
				if ( "bottom" in cursorAt ) {
					ui.position.top += ui.pointer.y - ui.offset.top - elem.outerHeight() + cursorAt.bottom;
				}
				if ( "right" in cursorAt ) {
					ui.position.left += ui.pointer.x - ui.offset.left - elem.outerWidth() + cursorAt.right;
				}
			});

		}

	});

	// grid option
	$.widget( "ui.draggable", $.ui.draggable, {
		options: {
			grid: false
		},

		_create: function() {

			var self = this,
				currentX, currentY;

			this._super();

			this.element.on( "dragbeforestart", function( event, ui ) {

				if ( !self.options.grid ) {
					return;
				}

				// Save off the start position, which may be overwritten during drag
				currentX = ui.position.left;
				currentY = ui.position.top;

			});

			this.element.on( "drag", function( event, ui ) {

				if ( !self.options.grid ) {
					return;
				}

				// Save off the intended intervals
				var x = self.options.grid[0],
					y = self.options.grid[1];

				// If x is actually something, check that user is at least half way to next point
				if ( x ) {
					if ( ui.position.left - currentX > x/2 ) {
						currentX = currentX + x;
					}	else if ( currentX - ui.position.left > x/2 ) {
						currentX = currentX - x;
					}
				}

				// If y is actually something, check that user is at least half way to next point
				if ( y ) {
					if ( ui.position.top - currentY > y/2 ) {
						currentY = currentY + y;
					} else if ( currentY - ui.position.top > y/2 ) {
						currentY = currentY - y;
					}
				}

				// If there threshold wasn't crossed these variables wouldn't be changed
				// Otherwise this will now bump the draggable to the next spot on grid
				ui.position.left = currentX;
				ui.position.top = currentY;

			});

		}

	});

	// opacity option
	$.widget( "ui.draggable", $.ui.draggable, {
		options: {
			opacity: false
		},

		_create: function() {

			var self = this,
				originalOpacity;

			this._super();

			this.element.on( "dragstart", function() {

				// No need to continue
				if ( !self.options.opacity ) {
					return;
				}

				// Cache the original opacity of draggable element to reset later
				originalOpacity = self.dragEl.css( 'opacity' );

				// Set draggable element to new opacity
				self.dragEl.css( 'opacity', self.options.opacity );

			});

			this.element.on( "dragstop", function() {

				// No need to continue
				if ( !self.options.opacity ) {
					return;
				}

				// Reset opacity
				self.dragEl.css( 'opacity', originalOpacity );

			});

		}

	});

	// TODO: handle droppables
	// revert + revertDuration options
	$.widget( "ui.draggable", $.ui.draggable, {
		options: {
			revert: false,
			revertDuration: 500
		},

		_create: function() {

			var self = this,
				originalLeft, originalTop, originalPosition;

			this._super();

			this.element.on( "dragbeforestart", function() {

				// No need to continue
				if ( !self.options.revert ) {
					return;
				}

				// Cache the original css of draggable element to reset later
				originalLeft = self.dragEl.css( 'left' );
				originalTop = self.dragEl.css( 'top' );
				originalPosition = self.dragEl.css( 'position' );

			});

			this.element.on( "dragstop", function() {

				// No need to continue
				if ( !self.options.revert ) {
					return;
				}

				// Reset to before drag
				self.dragEl.animate({
					left: originalLeft,
					top: originalTop,
					position: originalPosition
				}, self.options.revertDuration );

			});

		}

	});

	// zIndex option
	$.widget( "ui.draggable", $.ui.draggable, {
		options: {
			zIndex: false
		},

		_create: function() {

			var self = this,
				originalZIndex;

			this._super();

			this.element.on( "dragstart", function() {

				// No need to continue
				if ( !self.options.zIndex ) {
					return;
				}

				// Cache the original zIndex of draggable element to reset later
				originalZIndex = self.dragEl.css( 'z-index' );

				// Set draggable element to new zIndex
				self.dragEl.css( 'z-index', self.options.zIndex );

			});

			this.element.on( "dragstop", function() {

				// No need to continue
				if ( !self.options.zIndex ) {
					return;
				}

				// Reset zIndex
				self.dragEl.css( 'z-index', originalZIndex );

			});

		}

	});

	// TODO: need droppable working
	// scope option
	$.widget( "ui.draggable", $.ui.draggable, {
		options: {
			scope: "default"
		}
	});

	// scroll + scrollSensitivity + scrollSpeedType option
	$.widget( "ui.draggable", $.ui.draggable, {
		options: {
			scroll: true,
			scrollSpeed: null,
			scrollSensitivity: null
		},
		_create : function() {

			var self = this,
				handleScroll = this._handleScrolling,
				speed = this._speed;

			this._super();

			this._speed = function( distance ) {

				if ( self.options.scrollSpeed !== null ) {

					self.scrollSpeed = self.options.scrollSpeed;

					// Undo calculation that makes things go faster as distance increases
					distance = 0;
				}

				return speed.call( self, distance );

			};

			// Wrap member function to check for ability to scroll
			this._handleScrolling = function( pointerPosition ) {

				if ( !self.options.scroll ) {
					return;
				}

				if ( self.options.scrollSensitivity !== null ) {
					self.scrollSensitivity = self.options.scrollSensitivity;
				}

				handleScroll.call( self, pointerPosition );

			};

		}

	});

	// stack option
	$.widget( "ui.draggable", $.ui.draggable, {
		options: {
			stack: false
		},

		_create: function() {

			var self = this;

			this._super();

			this.element.on( "dragbeforestart", function() {

				var stack = self.options.stack,
					group, min;

				if ( !self.options.stack ) {
					return;
				}

				group = $.makeArray( $(stack) ).sort(function(a,b) {

					var aZIndex = parseInt( $(a).css("zIndex"), 10 ),
						bZIndex = parseInt( $(b).css("zIndex"), 10 );

					return ( aZIndex || 0) -  ( bZIndex|| 0);
				});

				if (!group.length) {
					return;
				}

				min = parseInt(group[0].style.zIndex, 10) || 0;

				$(group).each(function(i) {
					this.style.zIndex = min + i;
				});

				self.element[0].style.zIndex = min + group.length;

			});

		}

	});

}

return $.ui.draggable;

}));

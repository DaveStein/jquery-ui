TestHelpers.droppable = {
	shouldDrop: function( source, target, why ) {

		// TODO: Remove these lines after old tests upgraded
		if ( !source || !target ){
			ok(true, "missing test - untested code is broken code");
			return;
		}

		var dropped = this._detectDropped( source, target );

		why = why ? "Dropped: " + why : "";

		equal( dropped, true, why );

	},
	shouldNotDrop: function( source, target, why ) {

		// TODO: Remove these lines after old tests upgraded
		if ( !source || !target ){
			ok(true, "missing test - untested code is broken code");
			return;
		}

		var dropped = this._detectDropped( source, target );

		why = why ? "Not Dropped: " + why : "";

		equal( dropped, false, why );
	},
	_detectDropped: function( source, target ) {

		var targetOffset = target.offset(),
			sourceOffset = source.offset(),
			dropped = false;

		$(target).on( "drop", function() {
			dropped = true;
		});

		$(source).simulate( "drag", {
			dx: targetOffset.left - sourceOffset.left,
			dy: targetOffset.top - sourceOffset.top
		});

		return dropped;

	}
};

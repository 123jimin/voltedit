class VGraphPointTask extends VTask {
	constructor(editor, points, tick) {
		super(editor);
		this.points = points;
		this.tick = tick;
	}
}

/// Create a new point, with optional flags for connectedness of the previous point
class VGraphPointAddTask extends VGraphPointTask {
	constructor(editor, points, tick, newPoint, connectPrev) {
		super(editor, points, tick);
		this.newPoint = newPoint;
		this.connectPrev = connectPrev;
	}
}

/// Remove the current point, with an optional flag for connectedness of the previous point
class VGraphPointDelTask extends VGraphPointTask {
	constructor(editor, points, tick, connectPrev) {
		super(editor, points, tick);
		this.connectPrev = connectPrev;
	}
}

/// Change v and vf of a point
class VGraphPointChangeSlamTask extends VGraphPointTask {
	constructor(editor, points, tick, v, vf) {
		super(editor, points, tick);
		this.v = v;
		this.vf = vf;
	}
}

/// Change wide of a point
class VGraphPointChangeWideTask extends VGraphPointTask {
	constructor(editor, points, tick, wide) {
		super(editor, points, tick);
		this.wide = wide;
	}
}

/// Change `connected` value of a point (connect/disconnect an edge)
class VGraphPointChangeConnectedTask extends VGraphPointTask {
	constructor(editor, points, tick, connected) {
		super(editor, points, tick);
		this.connected = connected;
	}
}

/// Change a and b of a point (implement it later)
class VGraphPointChangeCurveTask extends VGraphPointTask {
	constructor(editor, points, tick, a, b) {
		super(editor, points, tick);
		this.a = a;
		this.b = b;
	}
}

class VGraphPointTask extends VTask {
	constructor(editor, points, callback, tick) {
		super(editor);
		this.points = points;
		this.callback = callback;
		this.tick = tick;
	}
	_getPoint() {
		const point = this.points.get(this.tick);
		if(!point || point.y !== this.tick) return null;
		return this._point = point;
	}
}

/// Create a new point, with optional flags for connectedness of the previous point | callback: (addNode, removeTick or -1)
class VGraphPointAddTask extends VGraphPointTask {
	constructor(editor, points, callback, tick, newPoint, connectPrev) {
		super(editor, points, callback, tick);
		this.newPoint = newPoint;
		this.connectPrev = connectPrev;
	}
	_validate() {
		const le = this.points.getLE(this.tick);
		if(le && le.y === this.tick) return false;

		const ge = this.points.getGE(this.tick);
		if(ge && ge.y === this.tick) return false;

		// Use VGraphPointChangeConnectedTask for this case
		if(this.connectPrev){
			if(le && le.data.wide !== this.newPoint.wide) return false;
		}
		if(this.newPoint.connected){
			if(ge && this.newPoint.wide !== ge.data.wide) return false;
		}

		return true;
	}
	_commit() {
		const [result, point] = this.points.add(this.tick, 0, this.newPoint);
		if(!result) return false;

		const prevPoint = point.prev();
		if(prevPoint) prevPoint.data.connected = this.connectPrev;

		this.callback(point, -1);
		return true;
	}
	_makeInverse() {
		let oldConnectPrev = false;
		const prevPoint = this.points.getLE(this.tick);
		if(prevPoint) oldConnectPrev = prevPoint.data.connected;

		return new VGraphPointDelTask(this.editor, this.points, this.callback, this.tick, oldConnectPrev);
	}
}

/// Remove the current point, with an optional flag for connectedness of the previous point | callback: see VGraphPointAddTask
class VGraphPointDelTask extends VGraphPointTask {
	constructor(editor, points, callback, tick, connectPrev) {
		super(editor, points, callback, tick);
		this.connectPrev = connectPrev;
	}
	_validate() {
		return !!this._getPoint();
	}
	_commit() {
		const prevPoint = this._point.prev();
		this._point.remove();

		if(prevPoint) prevPoint.data.connected = this.connectPrev;

		this.callback(prevPoint, this.tick);
	}
	_makeInverse() {
		let oldConnectPrev = false;
		const prevPoint = this._point.prev();
		if(prevPoint) oldConnectPrev = prevPoint.data.connected;
		
		const pointCopy = new VGraphPoint({
			'v': this._point.v,
			'vf': this._point.vf,
			'connected': this._point.connected,
			'wide': this._point.wide,
			'a': this._point.a,
			'b': this._point.b,
		});

		return new VGraphPointAddTask(this.editor, this.points, this.callback, this.tick, pointCopy, oldConnectPrev);
	}
}

/// Change wide of a point | callback: list of connected points
class VGraphPointChangeWideTask extends VGraphPointTask {
	constructor(editor, points, callback, tick, wide) {
		super(editor, points, callback, tick);
		this.wide = wide;
	}
}

/// Change `connected` value of a point (connect/disconnect an edge) | callback: list of connected points
class VGraphPointChangeConnectedTask extends VGraphPointTask {
	constructor(editor, points, callback, tick, connected) {
		super(editor, points, callback, tick);
		this.connected = connected;
	}
}

/// Change a simple property of a point | callback: changed point
class VGraphPointChangePropTask extends VGraphPointTask {
	_validate() {
		return !!(this._getPoint());
	}
	_afterCommit() {
		this.callback(this._point);
	}
}

/// Change v and vf of a point
class VGraphPointChangeSlamTask extends VGraphPointChangePropTask {
	constructor(editor, points, callback, tick, v, vf) {
		super(editor, points, tick);
		this.v = v;
		this.vf = vf;
	}
	_commit() {
		const point = this._point;
		point.data.v = this.v;
		point.data.vf = this.vf;
		this._afterCommit();
		return true;
	}
	_makeInverse() {
		const point = this._point;
		return new VGraphPointChangeSlamTask(this.editor, this.points, this.callback, this.tick,
			point.data.v, point.data.vf);
	}
}

/// Change a and b of a point (implement it later)
class VGraphPointChangeCurveTask extends VGraphPointChangePropTask {
	constructor(editor, points, callback, tick, a, b) {
		super(editor, points, callback, tick);
		this.a = a;
		this.b = b;
	}
	_commit() {
		const point = this._point;
		point.data.a = this.a;
		point.data.b = this.b;
		this._afterCommit();
		return true;
	}
	_makeInverse() {
		const point = this._point;
		return new VGraphPointChangeCurveTask(this.editor, this.points, this.callback, this.tick,
			point.data.a, point.data.b);
	}
}

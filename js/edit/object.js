class VEditObject {
	constructor() {}

	/// Display the selection of this object
	sel(view, selected) {}

	/// Returns: the task for removing this object
	delTask(editor) { return null; }

	/// Returns: the task for adding this object, translated by difference of given mouse events
	moveTask(editor, startEvent, endEvent) { return this.moveTickTask(editor, endEvent.tick-startEvent.tick); }
	/// Returns: the task for adding this object, translated by given tick
	moveTickTask(editor, tick) { return null; }

	/// Returns: an object which is translated from this object by difference of given mouse events
	getMoved(editor, startEvent, endEvent) { return this.getTickMoved(editor, endEvent.tick-startEvent.tick); }
	/// Returns: an object which is translated from this object by given tick
	getTickMoved(editor, tick) { return null; }

	/// 'Fake' a movement of this object through view
	fakeMoveTo(view, startEvent, event) {}
	/// Reset the fake movement done by above function
	resetFakeMoveTo(view) {}

	resizeTask(editor, tick) { return null; }

	serialize() { return []; }
	unserialize(data) {}
}

class VNoteObject extends VEditObject {
	constructor(type, lane, tick, len) {
		super();
		this.type = type;
		this.lane = lane;
		this.tick = tick;
		this.len = len;
	}
	sel(view, selected) {
		view.selNote(this.type, this.lane, this.tick, selected);
	}
	delTask(editor) {
		return new VNoteDelTask(editor, this.type, this.lane, this.tick);
	}
	moveTickTask(editor, tick) {
		return new VNoteForceAddTask(editor, this.type, this.lane, this.tick+tick, this.len);
	}
	getTickMoved(editor, tick) {
		if(!editor.chartData) return null;

		const noteData = editor.chartData.getNoteData(this.type, this.lane);
		if(!noteData) return null;

		const newY = this.tick+tick;
		const data = noteData.get(newY);

		if(!data) return null;
		// Don't check y or l (long notes can be merged)

		return data.data;
	}

	fakeMoveTo(view, startEvent, event) {
		view.fakeMoveNoteTo(this.type, this.lane, this.tick, this.lane, this.tick+event.tick-startEvent.tick);
	}
	resetFakeMoveTo(view) {
		view.fakeMoveNoteTo(this.type, this.lane, this.tick, this.lane, this.tick);
	}

	resizeTask(editor, tick) {
		let newLen = this.len+tick;
		if(newLen < 0) newLen = 0;
		return new VNoteForceResizeTask(editor, this.type, this.lane, this.tick, this.len, newLen);
	}

	serialize() { return [this.type, this.lane, this.tick, this.len]; }
	unserialize(data) { [this.type, this.lane, this.tick, this.len] = data; }
}

class VGraphEditObject extends VEditObject {
	constructor(point) {
		super();
		this.tick = point.y;

		// Do not store nodes in an edit object, since it can be invalidated by other edits.
	}
	getGraphPoints(editor) {
		return null;
	}

	getGraphPoint(editor) {
		const points = this.getGraphPoints(editor);
		return points && points.get(this.tick);
	}
}

class VLaserEditObject extends VGraphEditObject {
	constructor(lane, point) {
		super(point);
		this.lane = lane;
	}
	getGraphPoints(editor) {
		return editor.chartData.getNoteData('laser', this.lane);
	}
	getCallbacks(editor) {
		return editor.view.getLaserCallbacks(this.lane);
	}
}

class VLaserEditPoint extends VLaserEditObject {
	constructor(lane, point, isVF) {
		super(lane, point);
		this.isVF = isVF;
	}
	sel(view, selected) {
		view.selLaserEditPoint(this.lane, this.tick, this.isVF, selected);
	}
	delTask(editor) {
		const point = this.getGraphPoint(editor);

		// It is possible that the point is already removed (when multiple points are deleted at once)
		if(!point) return new VEmptyTask(editor);

		const prevPoint = point.prev();
		const prevConnected = prevPoint && prevPoint.data.connected;
		const nextPoint = point.next();
		const nextConnected = nextPoint && point.data.connected;

		if(point.data.isSlam()){
			if(prevConnected || nextConnected){
				const newV = this.isVF ? point.data.v : point.data.vf;
				return new VGraphPointChangeSlamTask(editor, this.getGraphPoints(editor),
					(point) => {
						const prevPoint = point.prev();
						if(prevPoint && prevPoint.data.connected)
							editor.view.updateLaser(this.lane, prevPoint);
						editor.view.updateLaser(this.lane, point);
						editor.view.selLaserEditPoint(this.lane, this.tick, true, false);
						editor.view.selLaserEditPoint(this.lane, this.tick, false, false);
					}, this.tick,
					newV, newV, !this.isVF);
			}else{
				// The result will be just a single edit point, so just delete the whole graph point.
				return new VGraphPointDelTask(editor, this.getGraphPoints(editor), this.getCallbacks(editor),
					this.tick, false);
			}
		}

		// Would want to be able to customize this
		let stayConnected = NOP(/* to suppress warning */) || true;
		const pointsToRemove = [this.tick];

		if(prevConnected && !prevPoint.data.isSlam()){
			const prevPrevPoint = prevPoint.prev();
			if(!prevPrevPoint || !prevPrevPoint.data.connected) pointsToRemove.push(prevPoint.y);
		}

		if(nextConnected && !nextPoint.data.isSlam()){
			if(!nextPoint.data.connected || !nextPoint.next()) pointsToRemove.push(nextPoint.y);
		}

		return VTask.join(pointsToRemove.map((tick) => new VGraphPointDelTask(editor, this.getGraphPoints(editor),
			this.getCallbacks(editor), tick, stayConnected && nextConnected)));
	}
	moveTask(editor, startEvent, endEvent) {
		return super.moveTask(editor, startEvent, endEvent);
	}
	moveTickTask(editor, tick) {
		const point = this.getGraphPoint(editor);
		if(!point) return null;

		let connectPrev = false;
		const prevPoint = point.prev();
		if(prevPoint && prevPoint.data.connected) connectPrev = true;

		const copiedPoint = {
			'v': point.data.v,
			'vf': point.data.vf,
			'connected': point.data.connected,
			'wide': point.data.wide,
			'a': point.data.a,
			'b': point.data.b,
		};

		return new VMaybeTask(new VGraphPointAddTask(editor, this.getGraphPoints(editor),
			this.getCallbacks(editor), this.tick+tick, copiedPoint, connectPrev));
	}
	getTickMoved(editor, tick) {
	}
}

class VLaserEditEdge extends VLaserEditObject {
}

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
		// TODO: maybe remove all overlapping notes?
		return new VMaybeTask(new VNoteAddTask(editor, this.type, this.lane, this.tick+tick, this.len));
	}
	getTickMoved(editor, tick) {
		if(!editor.chartData) return null;

		const noteData = editor.chartData.getNoteData(this.type, this.lane);
		if(!noteData) return null;

		const newY = this.tick+tick;
		const data = noteData.get(newY);
		if(!data || data.y !== newY || data.l !== this.len) return null;

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
		return new VMaybeTask(new VNoteResizeTask(editor, this.type, this.lane, this.tick, this.len, newLen));
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
}

class VLaserEditObject extends VGraphEditObject {
	constructor(lane, point) {
		super(point);
		this.lane = lane;
	}
	getPoints(editor) {
		return editor.chartData.getNoteData('laser', this.lane);
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
}

class VLaserEditEdge extends VLaserEditObject {
}

/// A no-op task
class VEmptyTask extends VTask {
	constructor(editor) { super(editor); }
	_validate() { return true; }
	_commit() { return true; }
	_makeInverse() { return this; }
}

/// A task that mayb be failed silently
class VMaybeTask extends VTask {
	constructor(task) {
		super(task.editor);
		this.task = task;
		this.no_op = false;
	}
	_validate() {
		this.no_op = !this.task._validate();
		return true;
	}
	_commit() {
		if(this.no_op) return true;
		return this.task._commit();
	}
	_makeInverse() {
		if(this.no_op) return new VEmptyTask(this.editor);
		else return this.task._makeInverse();
	}
}

/// Creates a note (fails if there's an overlapping note)
class VNoteAddTask extends VTask {
	constructor(editor, type, lane, tick, len) {
		super(editor);
		this.type = type;
		this.lane = lane;
		this.tick = tick;
		this.len = len;
	}
	_validate() {
		if(this.tick < 0) return false;
		const noteData = this.chartData.getNoteData(this.type, this.lane);
		if(!noteData) return true; // Since there were no note;
		return !noteData.intersects(this.tick, this.len);
	}
	_commit() {
		const result = this.chartData.addNote(this.type, this.lane, this.tick, this.len);
		if(!result || result[0] === false) return false;
		this.editor.view.addNote(this.type, this.lane, this.tick, this.len);

		return true;
	}
	_makeInverse() {
		return new VNoteDelTask(this.editor, this.type, this.lane, this.tick);
	}
}

class VNoteResizeTask extends VTask {
	constructor(editor, type, lane, tick, oldLen, newLen) {
		super(editor);
		this.type = type;
		this.lane = lane;
		this.tick = tick;
		this.oldLen = oldLen;
		this.newLen = newLen;
	}
	_validate() {
		if(this.tick < 0 || this.newLen < 0) return false;
		const noteData = this.chartData.getNoteData(this.type, this.lane);
		if(!noteData) return false;
		
		// Assure that there's no overlapping note except the one we're editing.
		const notes = noteData.getAll(this.tick, this.newLen+1);
		if(notes.length !== 1) return false;
		if(notes[0].y !== this.tick) return false;
		if(notes[0].l !== this.oldLen) return false;

		return true;
	}
	_commit() {
		// Get the note we're editing
		const noteData = this.chartData.getNoteData(this.type, this.lane);
		if(!noteData) return false;

		const note = noteData.get(this.tick);
		if(!note) return false;

		// Edit the DS and object in-place
		note.l = note.data.len = this.newLen;

		// Redraw this note
		this.editor.view.delNote(this.type, this.lane, this.tick);
		this.editor.view.addNote(this.type, this.lane, this.tick, this.newLen);

		return true;
	}
	_makeInverse() {
		return new VNoteResizeTask(this.editor, this.type, this.lane, this.tick, this.newLen, this.oldLen);
	}
}

class VNoteDelTask extends VTask {
	constructor(editor, type, lane, tick) {
		super(editor);
		this.type = type;
		this.lane = lane;
		this.tick = tick;
	}
	_validate() {
		const noteData = this.chartData.getNoteData(this.type, this.lane);
		if(!noteData) return false;
		const node = noteData.get(this.tick);
		if(!node) return false;
		return node.y === this.tick;
	}
	_commit() {
		if(!this.chartData.delNote(this.type, this.lane, this.tick)) return false;
		this.editor.view.delNote(this.type, this.lane, this.tick);
		return true;
	}
	_makeInverse() {
		const noteData = this.chartData.getNoteData(this.type, this.lane);
		const node = noteData.get(this.tick);

		return new VNoteAddTask(this.editor, this.type, this.lane, this.tick, node.l);
	}
}

/// Connects two laser segments
class VLaserConnectTask extends VTask {
	constructor(editor, lane, fromTick, toTick) {
		super(editor);
		this.lane = lane;
		this.fromTick = fromTick;
		this.toTick = toTick;
	}
}

/// Changes the VF value of a point
class VLaserSetVFTask extends VTask {
	constructor(editor, lane, tick, vf) {
		super(editor);
		this.lane = lane;
		this.tick = tick;
		this.vf = vf;
	}
	_validate() {
		const [graph, graphPoint] = this.chartData.getLaserPointNode(this.lane, this.tick);
		if(!graphPoint || graphPoint.y !== this.tick-graph.data.iy) return false;
		
		this._prevVF = graphPoint.data.vf;
		return true;
	}
	_commit() {
	}
	_makeInverse() {
		return new VLaserSetVFTask(this.editor, this.lane, this.tick, this._prevVF);
	}
}

/// Removes a point and (up to) two edges connecting it
class VLaserDelPointTask extends VTask {
}

/// Removes an edge
class VLaserDelEdgeTask extends VTask {
	constructor(editor, lane, tick) {
		super(editor);
		this.lane = lane;
		this.tick = tick;
	}
	_validate() {
		const [graph, graphPoint] = this.chartData.getLaserPointNode(this.lane, this.tick);
		if(!graphPoint || graphPoint.y !== this.tick) return false;
	}
}

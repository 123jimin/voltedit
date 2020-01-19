/// A no-op task
class VEmptyTask extends VTask {
	constructor(editor) { super(editor); }
	_validate() { return true; }
	_commit() { return true; }
	_makeInverse() { return this; }
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

/// Creates a note (and becomes no-op if there's an overlapping note)
class VNoteMaybeAddTask extends VNoteAddTask {
	constructor(editor, type, lane, tick, len) {
		super(editor, type, lane, tick, len);
		this.no_op = false;
	}
	_validate() {
		this.no_op = !super._validate();
		return true;
	}
	_commit() {
		if(this.no_op) return true;
		return super._commit();
	}
	_makeInverse() {
		if(this.no_op) return new VEmptyTask(this.editor);
		else return super._makeInverse();
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

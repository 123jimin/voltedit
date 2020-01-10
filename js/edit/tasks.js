class VNoteAddTask extends VTask {
	constructor(editor, type, lane, tick, len) {
		super(editor);
		this.type = type;
		this.lane = lane;
		this.tick = tick;
		this.len = len;
	}
	_validate() {
		const noteData = this.chartData.getNoteData(this.type, this.lane);
		if(!noteData) return true; // Since there were no note;
		return !noteData.intersects(this.tick, this.len);
	}
	_commit() {
		const result = this.chartData.addNote(this.type, this.lane, this.tick, this.len);
		if(!result || result[0] === false) return false;

		// TODO: do this more smartly
		this.editor.view.redraw();
		return true;
	}
	_makeInverse() {
		return new VNoteDelTask(this.editor, this.type, this.lane, this.tick);
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

		// TODO: do this more smartly
		this.editor.view.redraw();
		return true;
	}
	_makeInverse() {
		const noteData = this.chartData.getNoteData(this.type, this.lane);
		const node = noteData.get(this.tick);

		return new VNoteAddTask(this.editor, this.lane, this.tick, node.l);
	}
}

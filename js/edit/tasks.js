class VNoteAddTask extends VBaseTask {
	constructor(editor, lane, tick, len) {
		super(editor);
		this.lane = lane;
		this.tick = tick;
		this.len = len;
	}
	_validate() {
		const noteData = this.chartData.getNoteData(this.lane);
		if(!noteData) return true; // Since there were no note;
		return !noteData.intersects(this.tick, this.len);
	}
	_makeInverse() {
		return new VNoteDelTask(this.editor, this.lane, this.tick);
	}
}

class VNoteDelTask extends VBaseTask {
	constructor(editor, lane, tick) {
		super(editor);
		this.lane = lane;
		this.tick = tick;
	}
	_validate() {
		const noteData = this.chartData.getNoteData(this.lane);
		if(!noteData) return false;
		const node = noteData.get(this.tick);
		if(!node) return false;
		return node.y === this.tick;
	}
	_makeInverse() {
		const noteData = this.chartData.getNoteData(this.lane);
		const node = noteData.get(this.tick);

		return new VNoteAddTask(this.editor, this.lane, this.tick, node.l);
	}
}

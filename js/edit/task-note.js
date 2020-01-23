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

class VNoteTask extends VTask {
	constructor(editor, type, lane, tick) {
		super(editor);
		this.type = type;
		this.lane = lane;
		this.tick = tick;
	}
}

/// Creates a note (fails if there's an overlapping note)
class VNoteAddTask extends VNoteTask {
	constructor(editor, type, lane, tick, len) {
		super(editor, type, lane, tick);
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

/// Creates a note (overwriting existing notes)
class VNoteForceAddTask extends VNoteAddTask {
	constructor(editor, type, lane, tick, len) {
		super(editor, type, lane, tick, len);
		this.task = null;
	}
	_validate() { UNREACHABLE(); }

	commit() {
		if(this.tick < 0) return false;

		const noteData = this.chartData.getNoteData(this.type, this.lane);
		if(!noteData){
			return super._commitWithoutValidating();
		}

		const intersects = noteData.getAll(this.tick, this.len+1);

		// There's no intersection; proceed to add the note.
		if(intersects.length === 0){
			return super._commitWithoutValidating();
		}

		// The short note to be added is already occupied by another long or short note; do nothing.
		if(this.len === 0){
			this._inverse = new VEmptyTask(this.editor);
			return true;
		}

		// Adding this note will do nothing; do nothing.
		if(intersects.length === 1 && intersects[0].y <= this.tick && intersects[0].y + intersects[0].l >= this.tick + this.len){
			this._inverse = new VEmptyTask(this.editor);
			return true;
		}

		const tasks = [];
		let extendEnd = this.tick + this.len;
		let extendNode = null;

		// First, remove all notes, except the first one when they can be extended.
		intersects.forEach((node) => {
			if(node.y <= this.tick){
				extendNode = node;
				return;
			}
			// It doesn't matter whether `extendEnd` or `this.tick + this.l` is used.
			if(node.y + node.l >= extendEnd){
				extendEnd = node.y + node.l;
			}
			tasks.push(new VNoteDelTask(this.editor, this.type, this.lane, node.y));
		});

		// If the first note can be extended, extend it.
		// Else, add the long note
		if(extendNode){
			tasks.push(new VNoteResizeTask(this.editor, this.type, this.lane, extendNode.y, extendNode.l, extendEnd - extendNode.y));
		}else{
			tasks.push(new VNoteAddTask(this.editor, this.type, this.lane, this.tick, extendEnd - this.tick));
		}

		this.task = VTask.join(tasks);
		if(this.task && this.task.commit()){
			this._inverse = this.task._inverse;
			return true;
		}else{
			return false;
		}
	}
}

/// Resizes a note (fails if there's an overlapping note)
class VNoteResizeTask extends VNoteTask {
	constructor(editor, type, lane, tick, oldLen, newLen) {
		super(editor, type, lane, tick);
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
		// Do nothing when `oldLen` = `newLen`
		if(this.oldLen === this.newLen) return true;

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

/// Resizes a note (overwriting existing notes)
class VNoteForceResizeTask extends VNoteResizeTask {
	constructor(editor, type, lane, tick, oldLen, newLen) {
		super(editor, type, lane, tick, oldLen, newLen);
		this.task = null;
	}
	_validate() { UNREACHABLE(); }

	commit() {
		if(this.tick < 0 || this.newLen < 0) return false;
		const noteData = this.chartData.getNoteData(this.type, this.lane);
		if(!noteData) return false;

		// Shrinking the long note is not different from the parent task.
		if(this.newLen <= this.oldLen){
			return super._commitWithoutValidating();
		}

		const notes = noteData.getAll(this.tick, this.newLen+1);

		// Check that the first note is the expected one.
		if(notes.length === 0) return false;
		if(notes[0].y !== this.tick) return false;
		if(notes[0].l !== this.oldLen) return false;

		// If there's no other note, then just do it.
		if(notes.length === 1){
			return super._commitWithoutValidating();
		}

		const tasks = [];
		let extendEnd = this.tick + this.newLen;

		notes.forEach((node, ind) => {
			if(ind === 0) return;

			if(node.y + node.l >= extendEnd){
				extendEnd = node.y + node.l;
			}

			tasks.push(new VNoteDelTask(this.editor, this.type, this.lane, node.y));
		});

		tasks.push(new VNoteResizeTask(this.editor, this.type, this.lane, this.tick, this.oldLen, extendEnd - this.tick));

		this.task = VTask.join(tasks);
		if(this.task && this.task.commit()){
			this._inverse = this.task._inverse;
			return true;
		}else{
			return false;
		}
	}
}

class VNoteDelTask extends VNoteTask {
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

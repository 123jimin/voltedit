class VTask {
	constructor(editor) {
		this.editor = editor;
		this.chartData = editor.chartData;
		this._inverse = null;
	}
	// Things to override
	_validate() { return false; }
	_commit() { throw new Error("Not yet implemented!"); }
	_makeInverse() { return null; }

	// Things provided
	inverse() {
		if(this._inverse) return this._inverse;
		return this._inverse = this._makeInverse();
	}
	commit() {
		if(this._commonValidate() && this._validate()){
			// Creates an inverse job and commit it.
			this.inverse();
			this._commit();
			return true;
		}
		return false;
	}
	_commonValidate() { return !!(this.editor && this.chartData && this.editor.chartData === this.chartData); }
}

class VTaskManager {
	constructor(editor) {
		this.editor = editor;
		this.history = [];
		this.nextInd = 0;
	}
	clear() {
		this.history = [];
		this.nextInd = 0;
	}
	undo() {
		if(this.nextInd === 0 || this.history.length === 0) return false;
		const toUndo = this.history[this.nextInd-1];
		const inverse = toUndo.inverse();
		if(!inverse) return false;
		if(inverse.commit()) {
			--this.nextInd;
			return true;
		}

		console.error("Failed to undo", this.history[this.nextInd-1]);
		return false;
	}
	redo() {
		if(this.history.length === this.nextInd) return false;
		if(this.history[this.nextInd].commit()) {
			++this.nextInd;
			return true;
		}

		console.error("Failed to redo", this.history[this.nextInd]);
		return false;
	}
	do(task) {
		if(!task) return false;
		if(task.commit()) {
			if(this.history.length > this.nextInd)
				this.history = this.history.slice(0, this.nextInd);
			this.history.push(task);
			++this.nextInd;
			return true;
		} else {
			return false;
		}
	}
}

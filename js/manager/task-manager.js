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
		throw new Error("Can't make an inverse of a VTask with invalid state!");
	}
	commit() {
		if(this._commonValidate() && this._validate()){
			// Creates an inverse job and commit it.
			this._inverse = this._makeInverse();
			this._inverse._inverse = this;

			if(this._commit()) return true;
			console.error("Commit failed", this);
			return false;
		}
		return false;
	}
	_commonValidate() { return !!(this.editor && this.chartData && this.editor.chartData === this.chartData); }
}

class VTaskCollection extends VTask {
	constructor(editor, tasks) {
		super(editor);
		this.tasks = tasks;
	}
	commit() {
		const committed = [];
		let success = true;
		for(let i=0; i<this.tasks.length; ++i){
			const task = this.tasks[i];
			if(task.commit()){
				committed.push(task);
			}else{
				success = false;
				break;
			}
		}
		if(success){
			const reverses = [];
			for(let i=committed.length-1; i>=0; i--){
				reverses.push(committed[i].inverse());
			}
			this._inverse = new VTaskCollection(this.editor, reverses);
			return true;
		}
		for(let i=committed.length-1; i>=0; i--){
			if(!committed[i].inverse().commit()){
				throw new Error("Revert failed while doing multiple commits at once!");
			}
		}
	}
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
		const toUndo = this.history[this.nextInd-1][1];
		const inverse = toUndo.inverse();
		if(!inverse) return false;
		if(inverse.commit()) {
			this.editor.context.clearSelection();
			--this.nextInd;
			return true;
		}

		console.error("Failed to undo", this.history[this.nextInd-1]);
		return false;
	}
	redo() {
		if(this.history.length === this.nextInd) return false;
		if(this.history[this.nextInd][1].commit()) {
			this.editor.context.clearSelection();
			++this.nextInd;
			return true;
		}

		console.error("Failed to redo", this.history[this.nextInd]);
		return false;
	}
	do(label, task) {
		if(!task) return false;
		if(task.commit()) {
			if(this.history.length > this.nextInd)
				this.history = this.history.slice(0, this.nextInd);
			if(task._inverse) {
				this.history.push([label, task]);
				++this.nextInd;
			} else {
				console.error("Clearing history due to an undoable task", task);
				this.history = [];
				this.nextInd = 0;
			}
			return true;
		} else {
			return false;
		}
	}
}

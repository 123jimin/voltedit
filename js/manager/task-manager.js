class VTask {
	constructor(editor) {
		this.editor = editor;
		this.chartData = editor && editor.chartData;
		this._inverse = null;
	}
	// Things to override
	_validate() { return false; }
	_commit() { TODO(); }
	_makeInverse() { return null; }

	// Things provided
	inverse() {
		if(this._inverse) return this._inverse;
		throw new Error(L10N.t('task-undo-invalid'));
	}
	commit() {
		if(this._commonValidate() && this._validate()){
			// Creates an inverse job and commit it.
			this._inverse = this._makeInverse();
			this._inverse._inverse = this;

			if(this._commit()) return true;
			this.editor.error(L10N.t('task-commit-error', this.constructor.name));
			console.error(this);
			return false;
		}
		return false;
	}
	_commonValidate() { return !!(this.editor && this.chartData && this.editor.chartData === this.chartData); }
}

VTask.join = function VTask$merge(tasks) {
	if(tasks.length === 0) return null;
	if(tasks.length === 1) return tasks[0];
	return new VTaskCollection(tasks[0].editor, tasks);
};

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
				throw new Error(L10N.t('task-collection-commit-revert-error'));
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
	logTask(type, msg, history) {
		this.editor[type](L10N.t(msg, L10N.t(history[0])));
	}
	undo() {
		if(this.nextInd === 0 || this.history.length === 0) return false;
		const toUndo = this.history[this.nextInd-1];
		const inverse = toUndo[1].inverse();
		if(!inverse) return false;
		if(inverse.commit()) {
			this.editor.context.clearSelection();
			--this.nextInd;

			this.logTask('info', 'task-undo', toUndo);
			return true;
		}

		this.logTask('error', 'task-undo-error', toUndo);
		return false;
	}
	redo() {
		if(this.history.length === this.nextInd) return false;
		const toRedo = this.history[this.nextInd];

		if(toRedo[1].commit()) {
			this.editor.context.clearSelection();
			++this.nextInd;

			this.logTask('info', 'task-redo', toRedo);
			return true;
		}

		this.logTask('error', 'task-redo-error', toRedo);
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
				this.editor.warn(L10N.t('task-warn-clear-history', L10N.t(label)));
				this.history = [];
				this.nextInd = 0;
			}
			return true;
		} else {
			return false;
		}
	}
}

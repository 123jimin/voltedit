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
			if(!this._inverse){
				this._inverse = this._makeInverse();
				this._inverse._inverse = this;
			}

			if(this._commit()) return true;
			this.editor.error(L10N.t('task-commit-error', this.constructor.name));
			console.error(this);
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
		this.disposed = false;
	}
	commit() {
		if(this.disposed){
			throw new Error(L10N.t('task-collection-commit-disposed-error'));
		}

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

VTask.join = function VTask$merge(tasks) {
	if(tasks.length === 0) return null;
	if(tasks.length === 1) return tasks[0];

	const arr = [];
	const traverse = (tasks) => {
		tasks.forEach((task) => {
			if(task instanceof VTaskCollection){
				task.disposed = true;
				traverse(task.tasks);
			}else{
				arr.push(task);
			}
		});
	};
	traverse(tasks);

	return new VTaskCollection(tasks[0].editor, arr);
};

/// A no-op task
class VEmptyTask extends VTask {
	constructor(editor) { super(editor); }
	_validate() { return true; }
	_commit() { return true; }
	_makeInverse() { return this; }
}

/// A task that may be failed silently
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

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

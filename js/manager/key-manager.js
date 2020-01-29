/// A class for managing key inputs
class VKeyManager {
	constructor(editor) {
		this.editor = editor;
		this.ops = {};
		this.bindMap = {};
		this.queue = [];

		this._initOps();
		this.makeBindMap();

		document.body.addEventListener('keydown', this._onKeyPress.bind(this));
	}

	clearAllBinds() {
		this.bindMap = {};
	}
	bind(key, op) {
		this.bindMap[key] = op;
	}

	doOp(op) {
		if(op in this.ops){
			this.ops[op].call(this.editor);
		}else{
			this.editor.warn(L10N.t('operation-invalid', op));
		}
	}

	_isMatch(template) {
		template = template.split(' ');
		if(template.length > this.queue.length) return false;
		for(let i=0; i<template.length; ++i){
			const t = template[i];
			if(t === '*') continue;

			const q = this.queue[i+(this.queue.length-template.length)];
			if(t === q) continue;

			if(t.includes('/')){
				if(t.split('/').includes(q)) continue;
			}

			return false;
		}
		return true;
	}
	_onKeyPress(event) {
		if('target' in event){
			switch(event.target.tagName.toUpperCase()){
				case 'INPUT':
				case 'BUTTON':
				case 'TEXTAREA':
					return;
			}
		}
		const code = SIMPLECODE(event);
		if(!code) return;

		switch(code){
			case 'Shift': case 'ShiftRight':
			case 'Ctrl': case 'CtrlRight':
			case 'Alt': case 'AltRight':
				return;
		}

		this.queue.push(code);

		for(let key in this.bindMap){
			if(this._isMatch(key)){
				event.preventDefault();
				this.doOp(this.bindMap[key]);

				this.queue = [];
				return;
			}
		}

		if(this.queue.length >= 16) this.queue.shift();
	}

	_initOps() {
		const editor = this.editor;

		this._registerOp('new-chart-file', this.editor.createNewChart);
		this._registerOp('open-chart-file', () => this.editor.fileManager.showOpenChartDialog());
		this._registerOp('save-chart-file', () => this.editor.fileManager.saveChart());
		this._registerOp('save-chart-file-as', () => this.editor.fileManager.saveChartAs());
		this._registerOp('save-chart-kson', () => this.editor.fileManager.saveChartAsKSON());
		this._registerOp('save-chart-ksh', () => this.editor.fileManager.saveChartAsKSH());

		this._registerOp('undo', editor.undo);
		this._registerOp('redo', editor.redo);

		this._registerOp('cursor-forward', editor.moveCursor.bind(editor, +1));
		this._registerOp('cursor-backward', editor.moveCursor.bind(editor, -1));
		this._registerOp('resize-up-selected', editor.resizeSelected.bind(editor, +1));
		this._registerOp('resize-down-selected', editor.resizeSelected.bind(editor, -1));
		this._registerOp('decrease-edit-tick', () => editor.setEditSnap(editor.editSnapBeat-1));
		this._registerOp('increase-edit-tick', () => editor.setEditSnap(editor.editSnapBeat+1));
		this._registerOp('toggle-insert', () => editor.setInsertMode(!editor.insertMode));

		this._registerOp('context-chart', () => editor.setContext(new VEditChartContext(editor)));
		this._registerOp('context-bt', () => editor.setContext(new VEditNoteContext(editor, 'bt')));
		this._registerOp('context-fx', () => editor.setContext(new VEditNoteContext(editor, 'fx')));
		this._registerOp('context-laser-left', () => editor.setContext(new VEditLaserContext(editor, 0)));
		this._registerOp('context-laser-right', () => editor.setContext(new VEditLaserContext(editor, 1)));
		this._registerOp('context-laser-3', () => editor.setContext(new VEditLaserContext(editor, 2)));
		this._registerOp('context-laser-4', () => editor.setContext(new VEditLaserContext(editor, 3)));

		this._registerOp('add-bt-a', editor.addNote.bind(editor, 'bt', 0));
		this._registerOp('add-bt-b', editor.addNote.bind(editor, 'bt', 1));
		this._registerOp('add-bt-c', editor.addNote.bind(editor, 'bt', 2));
		this._registerOp('add-bt-d', editor.addNote.bind(editor, 'bt', 3));

		this._registerOp('add-fx-l', editor.addNote.bind(editor, 'fx', 0));
		this._registerOp('add-fx-r', editor.addNote.bind(editor, 'fx', 1));

		this._registerOp('clear-selection', () => editor.context.clearSelection());
		this._registerOp('delete-selection', () => editor.context.deleteSelection());

		this._registerOp('max-440', () => { document.location.href = "https://youtu.be/5tCEzv_bu9Q"; });
	}
	_registerOp(op, func) {
		this.ops[op] = func;
	}

	makeBindMap() {
		this.clearAllBinds();

		this.bind("Ctrl+N", 'new-chart-file');
		this.bind("Ctrl+O", 'open-chart-file');
		this.bind("Ctrl+S", 'save-chart-file');
		this.bind("Ctrl+Shift+S", 'save-chart-file-as');

		this.bind("Ctrl+Z", 'undo');
		this.bind("Ctrl+Y", 'redo');

		this.bind("Up", 'cursor-forward');
		this.bind("Down", 'cursor-backward');
		this.bind("Ctrl+Up", 'resize-up-selected');
		this.bind("Ctrl+Down", 'resize-down-selected');
		this.bind("A", 'decrease-edit-tick');
		this.bind("D", 'increase-edit-tick');

		this.bind("F", 'toggle-insert');

		this.bind("W", 'context-bt');
		this.bind("S", 'context-fx');
		this.bind("Q", 'context-laser-left');
		this.bind("E", 'context-laser-right');
		this.bind("Alt+Q", 'context-laser-3');
		this.bind("Alt+E", 'context-laser-4');

		this.bind("Backspace", 'delete-selection');
		this.bind("Delete", 'delete-selection');

		this.bind("1", 'add-bt-a');
		this.bind("2", 'add-bt-b');
		this.bind("3", 'add-bt-c');
		this.bind("4", 'add-bt-d');
		this.bind("5", 'add-fx-l');
		this.bind("6", 'add-fx-r');

		this.bind("Up Up Down Down Left Right Left Right B A Enter", 'max-440');
	}
}

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

	_isMatch(template) {
		template = template.split(' ');
		if(template.length < this.queue.length) return false;
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

				const op = this.bindMap[key];
				if(op in this.ops){
					this.ops[op].call(this.editor);
				}else{
					console.warn("Operation '%s' is not registered to keyManager.", op);
				}
				this.queue = [];
				return;
			}
		}

		if(this.queue.length >= 16) this.queue.shift();
	}
	
	_initOps() {
		this._registerOp('undo', this.editor.undo);
		this._registerOp('redo', this.editor.redo);
		
		this._registerOp('add-bt-a', this.editor.addBt.bind(this.editor, 0));
		this._registerOp('add-bt-b', this.editor.addBt.bind(this.editor, 1));
		this._registerOp('add-bt-c', this.editor.addBt.bind(this.editor, 2));
		this._registerOp('add-bt-d', this.editor.addBt.bind(this.editor, 3));

		this._registerOp('add-fx-l', this.editor.addFx.bind(this.editor, 0));
		this._registerOp('add-fx-r', this.editor.addFx.bind(this.editor, 1));
		
		this._registerOp('max-440', function(){ document.location.href = "https://youtu.be/5tCEzv_bu9Q"; });
	}
	_registerOp(op, func) {
		this.ops[op] = func;
	}

	makeBindMap() {
		this.clearAllBinds();

		this.bind("Ctrl+Z", 'undo');
		this.bind("Ctrl+Y", 'redo');

		this.bind("1", 'add-bt-a');
		this.bind("2", 'add-bt-b');
		this.bind("3", 'add-bt-c');
		this.bind("4", 'add-bt-d');
		this.bind("5", 'add-fx-l');
		this.bind("6", 'add-fx-r');

		this.bind("Up Up Down Down Left Right Left Right B A Enter", 'max-440');
	}
}

/// A class for managing key inputs
class VKeyManager {
	constructor(editor) {
		this.editor = editor;
		this.ops = {};
		this.bindMap = {};
		this.queue = [];
		
		document.body.addEventListener('keydown', this._onKeyPress.bind(this));
	}
	regOp(op, func) {
		this.ops[op] = func;
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
			
			const q = this.queue[i+(queue.length-template.length)];
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
		
		if(code.startsWith('Shift')) return;
		if(code.startsWith('Ctrl')) return;
		if(code.startsWith('Alt')) return;
		
		this.queue.push(code);

		for(let key in this.bindMap){
			if(this._isMatch(key)){
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

		if(this.queue.length > 16) this.queue.shift();
		console.log(this.queue);
	}
}

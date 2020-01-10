/// A class for managing key inputs
class VKeyManager {
	constructor(editor) {
		this.editor = editor;
		
		document.body.addEventListener('keydown', this._onKeyPress.bind(this));
	}
	_onKeyPress(event) {
	}
}

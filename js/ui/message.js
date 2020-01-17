// Class for displaying messages
class VMessage {
	constructor(editor, message, className) {
		this.parentElem = editor.elem.querySelector("div.messages");

		const templateContent = editor.elem.querySelector("template.message").content;
		this.elem = templateContent.querySelector("div.message").cloneNode(true);
		this.elem.querySelector("span.message-text").innerText = message;
		this.elem.classList.add(className);

		this.parentElem.appendChild(this.elem);
		this.decaying = false;

		this.autoDecay = setTimeout(() => this.decay(800), 5000);
		this.elem.addEventListener('click', () => this.decay(300));
	}

	decay(time) {
		if(this.decaying) return;
		if(this.autoDecay) {
			clearTimeout(this.autoDecay);
			this.autoDecay = null;
		}
		this.elem.style.transitionDuration = `${time}ms`;
		this.elem.style.opacity = 0;
		this.decaying = true;

		setTimeout(() => {
			this.elem.remove();
			this.elem = null;
			this.parentElem = null;
		}, time);
	}
}

class VAlertMessage extends VMessage {
	constructor(editor, message) {
		super(editor, message, 'alert');
	}
}

class VWarnMessage extends VMessage {
	constructor(editor, message) {
		super(editor, message, 'warn');
	}
}

class VInfoMessage extends VMessage {
	constructor(editor, message) {
		super(editor, message, 'info');
	}
}

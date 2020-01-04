/// Class for managing the editor toolbar
class VToolbar {
	constructor(editor) {
		this.editor = editor;
		this.elem = editor.elem.querySelector(".toolbar");

		this.tabs = [].slice.call(this.elem.querySelectorAll(".toolbar-tab li"));
		this.panels = [].slice.call(this.elem.querySelectorAll(".toolbar-panel"));

		if(this.tabs.length != this.panels.length) {
			throw new Error(`VToolbar: {this.tabs.length} tabs != {this.panels.length} panels!`);
		}

		this.currTab = -1;
		this.changeTab(0);

		this.tabs.forEach((elem, ind) => {
			elem.addEventListener('click', (event) => {
				this.changeTab(ind);
			});
		});
	}

	changeTab(ind) {
		if(!isFinite(ind) || ind < 0 || ind >= this.tabs.length) return;

		if(this.currTab >= 0 && this.currTab < this.tabs.length) {
			this.tabs[this.currTab].classList.remove('active');
			this.panels[this.currTab].classList.remove('active');
		}

		this.currTab = ind;

		this.tabs[ind].classList.add('active');
		this.panels[ind].classList.add('active');
	}
}

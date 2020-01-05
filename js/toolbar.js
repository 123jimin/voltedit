/// Class for managing the editor toolbar
class VToolbar {
	constructor(editor) {
		this.editor = editor;
		this.elem = editor.elem.querySelector(".toolbar");

		this.tabs = [].slice.call(this.elem.querySelectorAll(".toolbar-tab li"));
		this.panels = [].slice.call(this.elem.querySelectorAll(".toolbar-panel"));

		if(this.tabs.length != this.panels.length) {
			throw new Error(`VToolbar: ${this.tabs.length} tabs != ${this.panels.length} panels!`);
		}

		this.currTab = -1;
		this.changeTab(0);

		this.tabs.forEach((elem, ind) => {
			elem.addEventListener('click', (event) => {
				this.changeTab(ind);
			});
		});

		this._setupHome();
		this._setupOptions();
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

	_setupHome() {
		this._button('toolbar-open', 'toolbar-open-desc', this.editor.showOpenFileDialog);
		this._button('toolbar-save-kson', 'toolbar-save-kson-desc', this.editor.saveToKSON);
		this._button('toolbar-save-ksh', 'toolbar-save-ksh-desc', this.editor.saveToKSH);
	}

	_setupOptions() {
		this._bind('toolbar-language-select', 'ui:language', (v) => L10N.l(v));
		this._bind('toolbar-note-width', 'editor:note:width', (v) => this.editor.view.scale.setNoteWidth(v));
		this._bind('toolbar-measure-scale', 'editor:measure:scale', (v) => this.editor.view.scale.setMeasureScale(v));
		this._bind('toolbar-margin-side', 'editor:margin:side', (v) => this.editor.view.scale.setMarginSide(v));
		this._bind('toolbar-margin-bottom', 'editor:margin:bottom', (v) => this.editor.view.scale.setMarginBottom(v));
	}

	_button(className, title, onClick) {
		const elem = this.elem.querySelector(`.${className}`);
		if(!elem){
			console.warn(`VToolbar button failed: class ${className} does not exist!`);
			return;
		}
		if(title) elem.title = L10N.t(title);
		elem.addEventListener('click', (event) => {
			onClick.call(this.editor);
		});
	}

	_bind(className, configName, onChange, validate) {
		const settings = this.editor.settings;
		if(!validate) validate = () => true;

		const elem = this.elem.querySelector(`.${className}`);
		if(!elem){
			console.warn(`VToolbar bind failed: class ${className} does not exist!`);
			return;
		}

		switch(elem.tagName.toUpperCase()){
			case 'SELECT':
				elem.querySelector(`option[value="${settings.get(configName)}"]`).setAttribute('selected', true);
				elem.addEventListener('change', (event) => {
					if(validate(elem.value)){
						settings.set(configName, elem.value);
						onChange(elem.value);
					}
				});
				return;
			case 'INPUT':
				elem.value = settings.get(configName);
				elem.title = `${L10N.t('toolbar-default')} ${settings.defaultValue(configName)}`;
				elem.addEventListener('change', (event) => {
					if(validate(elem.value)){
						settings.set(configName, elem.value);
						onChange(elem.value);
					}
				});
				return;
		}
		console.warn(`VToolbar bind failed: tag ${elem.tagName} is not well understood.`);
	}
}

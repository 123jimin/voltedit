/// A class for managing settings
class VSettings {
	constructor() {
		this.fields = {};
		this.settings = {};

		this._setFields();
		this._reset();

		const savedSettingsStr = window.localStorage.getItem('voltedit:settings');
		if(savedSettingsStr){
			try{
				const savedSettings = JSON.parse(savedSettingsStr);
				if(savedSettings) for(let key in savedSettings) {
					if(key in this.fields) this.settings[key] = savedSettings[key];
				}
			}catch(e){
				logger.error(e);
			}
		}
	}

	_setFields() {
		this._define('ui:language', "en");

		this._define('editor:note:width', 9);
		this._define('editor:margin:side', 15);
		this._define('editor:margin:bottom', 40);
		this._define('editor:measure:scale', 20);
		this._define('editor:columns', 4);
	}

	_define(key, defaultValue) {
		this.fields[key] = {
			'defaultValue': defaultValue,
		};
	}

	set(key, value) {
		if(!key) return;
		if(key in this.fields){
			if(this.settings[key] === value){
				return;
			}
			this.settings[key] = value;
			this.save();
		}else{
			logger.error(`Key '${key}' does not exist in settings!`);
		}
	}

	get(key) {
		if(!key) return null;
		if(key in this.settings){
			return this.settings[key];
		}else if(key in this.fields){
			return this.fields[key].defaultValue;
		}else{
			logger.error(`Key '${key}' does not exist in settings!`);
			return null;
		}
	}

	isSet(key) {
		return key in this.settings;
	}

	isConfig(key) {
		return key in this.fields;
	}

	defaultValue(key) {
		return this.fields[key].defaultValue;
	}

	save() {
		window.localStorage.setItem('voltedit:settings', JSON.stringify(this.settings));
	}

	reset() {
		this._reset();
		this.save();
	}

	/// Reset
	_reset() {
		this.settings = {};
	}
}

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
				console.error(e);
			}
		}
	}

	_setFields() {
		this._define('ui:language', "en");
	}

	_define(key, defaultValue) {
		this.fields[key] = {
			'defaultValue': defaultValue,
		};
	}

	set(key, value) {
		if(key in this.settings){
			this.settings[key] = value;
			this.save();
		}else{
			console.error(`Key '${key}' does not exist in settings!`);
		}
	}

	get(key) {
		if(key in this.settings){
			return this.settings[key];
		}else if(key in this.fields){
			return this.fields[key].defaultValue;
		}else{
			console.error(`Key '${key}' does not exist in settings!`);
			return null;
		}
	}

	isSet(key) {
		return key in this.settings;
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

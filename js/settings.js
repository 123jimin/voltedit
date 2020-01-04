/// A class for managing settings
class VSettings {
	constructor() {
		this.settings = {};
		this._reset();

		const savedSettingsStr = window.localStorage.getItem('voltedit:settings');
		if(savedSettingsStr){
			try{
				const savedSettings = JSON.parse(savedSettingsStr);
				if(savedSettings) for(let key in savedSettings) {
					if(key in this.settings) this.settings[key] = savedSettings[key];
				}
			}catch(e){
				console.error(e);
			}
		}
	}

	save() {
		window.localStorage.setItem('voltedit:settings');
	}

	reset() {
		this._reset();
		this.save();
	}

	/// Reset 
	_reset() {
	}
}

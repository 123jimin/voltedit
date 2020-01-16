const L10N = ((lines) => {
	let data = {};
	let currKey = "";
	lines.forEach((line) => {
		if(line[0] === '#') return;
		if(line[0] === ' ' || line[0] === '\t') {
			line = line.trim();
			if(line === "") return;
			if(!(currKey in data)) data[currKey] = {};
			const match = line.match(/^([a-z\-]+):\s*(\S.*)$/i);
			if(match) data[currKey][match[1].toLowerCase()] = match[2];
		} else {
			if(line === "") return;
			currKey = line.trim();
		}
	});
	Object.freeze(data);
	return ({
		'_d': data, '_l': "en", 't': function L10N_getText(id, ...args){
			if(!(id in this._d)) return id;
			const values = this._d[id];

			if(!(this._l in values)) return id;
			let str = values[this._l].replace(/%([\d%])/g, (txt, ind) => ind === '%' ? '%' : ind>0 && ind<=args.length ? args[ind-1] : txt);
			return str;
		}, 'l': function L10N_setLocale(l) {
			this._l = l.toLowerCase();

			[].forEach.call(document.querySelectorAll("button,span,h1,h2,h3,h4,h5,h6,label"), (elem) => {
				[].forEach.call(elem.classList, (className) => {
					let id = "";
					switch(elem.tagName.toUpperCase()){
						case 'BUTTON':
							id = className;
							break;
						default:
							if(!className.startsWith("txt-")) return;
							id = className.slice(4);
					}
					if(!(id in this._d)) return;
					elem.innerText = this.t(id);
				});
			});
		}
	});
})(L10N_STRING.trim().split('\n'));

L10N_STRING = "";

class VChartData {
	constructor() {
		// KSON-based structure with some modifications
		this.version = "Unknown VOLTEdit chart data";
		this.meta = {
			'title': "", 'artist': "", 'chart_author': "",
			'difficulty': {'idx': 0},
			'level': 1,
		};
		this.beat = {
			'bpm': [{'y': 0, 'v': 120}],
			'resolution': 240,
		};
		this.gauge = {};
		
		// XXX: Unlike KSON, NoteInfo.bt and NoteInfo.fx are each an array of dictionaries,
		// where each dictoinary's key is `Interval.y` and value is `Interval.l`.
		// Similarly, NoteInfo.laser is an array of two dictionaries,
		// each dictionary's key is `LaserSection.y` and value is the rest.
		this.note = {};

		this.audio = {};
		this.camera = {};
		this.bg = {};
		this.impl = {};
	}

	toKSON() {
		const kson = {
			'version': this.version,
			'meta': this.meta,
			'beat': this.beat,
			'gauge': this.gauge,
			'note': this._getKSONNote(),
			'audio': this.audio,
			'camera': this.camera,
			'bg': this.bg,
			'impl': this.impl
		};

		return JSON.stringify(kson);
	}

	_getKSONNote() {
		const note2arr = (dict) => {
			const arr = [];
			for(let y in dict) {
				const obj = {'y': +y};
				if(dict[y]) obj.l = +dict[y];
				arr.push(obj);
			}

			arr.sort((a, b) => a.y-b.y);
			return arr;
		};
		const laser2arr = (dict) => {
			const arr = [];
			for(let y in dict) {
				const obj = {'y': +y};
				for(let k in dict[y]) obj[k] = dict[y][k];
				arr.push(obj);
			};

			arr.sort((a, b) => a.y-b.y);
			return arr;
		};
		return {
			'bt': this.note.bt.map(note2arr),
			'fx': this.note.fx.map(note2arr),
			'laser': this.note.laser.map(laser2arr)
		};
	}
}

VChartData.create = function VChartData$create(file) {
	if(file[0] === '{') {
		const kson = KSONData.create(file);
		if(kson !== null) return kson;
	}

	const ksh = KSHData.create(file);
	return ksh;
};

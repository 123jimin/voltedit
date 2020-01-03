class VChartData {
	constructor() {
		// KSON-based structure
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
		this.note = {};
		this.audio = {};
		this.camera = {};
		this.bg = {};
		this.impl = {};
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

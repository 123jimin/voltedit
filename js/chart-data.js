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
}

VChartData.create = function VChartData$create(file) {
	if(file[0] === '{') {
		const kson = KSONData.create(file);
		if(kson !== null) return kson;
	}

	const ksh = KSHData.create(file);
	return ksh;
};

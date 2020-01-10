/// KSON-based chart data structure with some modifications.
/// Most noticeably, many arrays with {'y': ..., 'v': ...} are replaced by AATrees.
class VChartData {
	constructor() {
		this.version = "Unknown VOLTEdit chart data";
		this.meta = {
			'title': "", 'artist': "", 'chart_author': "",
			'difficulty': {'idx': 0},
			'level': 1,
		};

		// XXX: bpm is an AATree
		this.beat = {
			'bpm': new AATree([{'y': 0, 'data': 120}]),
			'resolution': 240,
		};
		this.gauge = {};

		// XXX: bt, fx, laser are each an array of AATrees
		this.note = {};

		this.audio = {};
		this.camera = {};
		this.bg = {};
		this.impl = {};
	}

	// Computes the last tick of anything.
	getLastTick() {
		let lastTick = 0;
		const check = (tick) => { if(lastTick < tick) lastTick = tick; }
		const checkArr = (arr) => { if(arr && arr.length) check(arr[arr.length-1].y); };
		const checkTree = (tree) => { const last = tree.last(); if(last) check(last.y+last.l); };

		if(this.note){
			if(this.note.bt) this.note.bt.map(checkTree);
			if(this.note.fx) this.note.fx.map(checkTree);
			if(this.note.laser) this.note.laser.map(checkTree);
		}

		if(this.beat) {
			checkTree(this.beat.bpm);

			if(this.beat.time_sig && this.beat.time_sig.length > 0) {
				let measureTick = 0;
				let prevMeasureInd = 0;
				let prevMeasureLen = 0;

				this.beat.time_sig.forEach((sig) => {
					measureTick += (sig.idx - prevMeasureInd) * prevMeasureLen;
					prevMeasureInd = sig.idx;
					prevMeasureLen = sig.v.d * (this.beat.resolution*4) / sig.v.n;
				});

				check(measureTick);
			}

			if(this.beat.scroll_speed && this.beat.scroll_speed.length > 0) {
				// TODO: check scroll speed
			}
		}

		return lastTick;
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
		const note2arr = (tree) => {
			const arr = [];
			tree.traverse((node) => {
				const obj = {'y': node.y};
				if(node.l) obj.l = node.l;
				arr.push(obj);
			});
			return arr;
		};
		const laser2arr = (tree) => {
			const arr = [];
			tree.traverse((node) => {
				const obj = {'y': node.y};
				for(let k in node.data)
					obj[k] = node.data[k];
				arr.push(obj);
			});
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

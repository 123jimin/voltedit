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

		// XXX: bpm, scroll_speed are each an AATree, but time_sig is NOT.
		this.beat = {
			'bpm': new AATree([{'y': 0, 'data': 120}]),
			'resolution': 240,
		};
		this.gauge = {};

		// XXX: bt, fx, laser are each an array of AATrees
		this.note = {};
		this._initNote();

		this.audio = {};
		this.camera = {};
		this.bg = {};
		this.impl = {};
	}

	/// Yup, VOLTEdit internally supports more than 4 BT lanes, 2 FX lanes, and 2 lasers.
	getLaneCount(type) {
		return (this.note && this.note[type] && this.note[type].length) || 0;
	}
	getNoteData(type, lane) {
		if(!this.note) return null;
		if(!(type in this.note)) return null;
		return this.note[type][lane];
	}

	/// Returns: null if param is invalid, [success, node] otherwise
	addNote(type, lane, tick, len) {
		if(!this.note) this.note = {};
		if(!this.note[type]) this.note[type] = [];
		this._initTreeArr(this.note[type], lane+1);

		return this.getNoteData(type, lane).add(tick, len, new VNoteObject(type, lane, tick, len));
	}
	/// Returns: whether the deletion is successful
	delNote(type, lane, tick) {
		const noteData = this.getNoteData(type, lane);
		if(!noteData) return false;

		const node = noteData.get(tick);
		if(!node || node.y !== tick) return false;

		node.remove();
		return true;
	}
	addLaser(lane, graph) {
		if(!this.note) this.note = {};
		if(!this.note.laser) this.note.laser = [];
		this._initTreeArr(this.note.laser, lane+1);

		return this.note.laser[lane].add(graph.iy, graph.getLength(), graph);
	}

	addBPM(tick, value) {
		return this.beat.bpm.add(tick, 0, value);
	}

	iterMeasures(iterator) {
		if(!this.beat || !this.beat.time_sig) return 0;

		const tickUnit = (this.beat.resolution||240)*4;
		const lastTick = this.getLastTick();
		const DEFAULT_TIME_SIG = {'v': {'n': 4, 'd': 4}};

		let measureTick = 0;
		let measureIndex = 0;
		let currTimeSigInd = -1;

		while(measureTick <= lastTick){
			if(currTimeSigInd+1 < this.beat.time_sig.length) {
				const nextTimeSig = this.beat.time_sig[currTimeSigInd+1];
				if(nextTimeSig.idx <= measureIndex) {
					++currTimeSigInd;
				}
			}
			const currTimeSig = currTimeSigInd >= 0 ? this.beat.time_sig[currTimeSigInd] : DEFAULT_TIME_SIG;
			const currMeasureLength = currTimeSig.v.n * tickUnit / currTimeSig.v.d;

			iterator(measureIndex, measureTick, currTimeSig.v.n, currTimeSig.v.d, currMeasureLength);

			++measureIndex;
			measureTick += currMeasureLength;
		}

		return measureTick;
	}

	/// Computes the last tick of anything.
	getLastTick() {
		let lastTick = 0;
		const check = (tick) => { if(lastTick < tick) lastTick = tick; }
		const checkTree = (tree) => { const last = tree.last(); if(last) check(last.y+last.l); };

		if(this.note){
			if(this.note.bt) this.note.bt.map(checkTree);
			if(this.note.fx) this.note.fx.map(checkTree);
			if(this.note.laser) this.note.laser.map(checkTree);
		}

		if(this.beat) {
			checkTree(this.beat.bpm);

			if(this.beat.time_sig && this.beat.time_sig.length > 0) {
				const tickPerWhole = (this.beat.resolution || 240) * 4
				let measureTick = 0;
				let prevMeasureInd = 0;
				let prevMeasureLen = tickPerWhole

				this.beat.time_sig.forEach((sig) => {
					measureTick += (sig.idx - prevMeasureInd) * prevMeasureLen;
					prevMeasureInd = sig.idx;
					prevMeasureLen = sig.v.n * tickPerWhole / sig.v.d;
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
			'beat': this._getBeatNode(),
			'gauge': this.gauge,
			'note': this._getKSONNote(),
			'audio': this.audio,
			'camera': this.camera,
			'bg': this.bg,
			'impl': this.impl
		};

		return JSON.stringify(kson);
	}
	_getBeatNode() {
		const beatNode = {
			'bpm': []
		};

		this.beat.bpm.traverse((node) => {
			beatNode.bpm.push({'y': node.y, 'v': node.data});
		});

		if(this.beat.time_sig && this.beat.time_sig.length > 0){
			beatNode.time_sig = this.beat.time_sig;
		}

		// TODO: What should I do with scroll_speed?

		if(this.beat.resolution && this.beat.resolution !== 240){
			beatNode.resolution = this.beat.resolution;
		}

		return beatNode;
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
				arr.push(node.data.toKSON());
			});
			return arr;
		};
		const obj = {};
		if(this.note.bt) obj.bt = this.note.bt.map(note2arr);
		if(this.note.fx) obj.fx = this.note.fx.map(note2arr);
		if(this.note.laser) obj.laser = this.note.laser.map(laser2arr);

		return obj;
	}

	_initTreeArr(arr, size) {
		while(arr.length < size) arr.push(new AATree());
	}
	_initNote() {
		this.note = {'bt': [], 'fx': [], 'laser': []};
		this._initTreeArr(this.note.bt, 4);
		this._initTreeArr(this.note.fx, 2);
		this._initTreeArr(this.note.laser, 2);
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

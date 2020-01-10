const KSH_DEFAULT_MEASURE_TICK = 192;
const KSH_LASER_SLAM_TICK = KSH_DEFAULT_MEASURE_TICK / 32;
const KSH_LASER_VALUES = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmno";
const KSH_LASER_LOOKUP = Object.freeze(((str) => {
	const dict = {};
	for(let i=0; i<str.length; ++i) dict[str[i]] = i;
	return dict;
})(KSH_LASER_VALUES));

const KSH_LINE_TYPE = Object.freeze({'HEADER': 0, 'BODY': 1});
const KSH_REGEX = Object.freeze({
	'OPTION': /^([^=]+)=(.+)$/,
	'LINE': /^([012]{4})\|(.{2})\|([0-9A-Za-o\-:]{2})(?:(@\(|@\)|@<|@>|S<|S>)([0-9;]+))?$/
});

/// Just a data class representing time signatures
class KSHTimeSig {
	constructor(str) {
		const timeSig = this.timeSig = str.split('/').map((x) => parseInt(x));
		if(timeSig.length != 2 || timeSig.some((x) => !isFinite(x) || x < 1))
			throw new Error("Invalid ksh time signature! [invalid value]");
		if(KSH_DEFAULT_MEASURE_TICK % timeSig[1] != 0)
			throw new Error("Invalid ksh time signature! [invalid denom]");
	}
	toKSON() {
		return {'n': this.timeSig[0], 'd': this.timeSig[1]};
	}
}

/// A data class representing a single KSH chartline with modifiers
class KSHLine {
	constructor(match, mods) {
		this.bt = match[1]; this.fx = match[2];
		this.laser = match[3]; this.rot = match[4] || "";
		this.mods = mods || [];
		// Location and length of this line in ticks
		// Will be computed later in _setKSONBeatInfo of KSHData
		this.tick = 0;
		this.len = 0;
	}
}

/// A class representing a laser segment
class KSHGraph {
	/// isRelative: whether the graph is relative (true for lasers, false for zooms)
	constructor(isRelative, options) {
		this.isRelative = isRelative;
		if(isRelative) {
			this.collapseTick = options.collapseTick || 0;
			this.range = options.range || 1;
			this.iy = options.y || 0;
		} else {
			this.collapseTick = 0;
			this.range = 1;
			this.iy = 0;
		}
		// Array of relative y values
		this.ys = [];
		// Array of values
		this.vs = [];
		// Arrays of final values
		this.vfs = [];
	}
	push(y, v) {
		let lastInd = this.ys.length - 1;
		if(y < this.ys[lastInd]) throw new Error("Invalid insertion order in KSHGraph!");
		if(y <= this.ys[lastInd] + this.collapseTick) {
			this.vfs[lastInd] = v;
		} else {
			this.ys.push(y);
			this.vs.push(v);
			this.vfs.push(v);
		}
	}
	getLength() {
		return this.ys.length ? this.ys[this.ys.length-1]-this.iy : 0;
	}
	toKSON() {
		let segments = [];
		// TODO: simplify using curves
		for(let i=0; i<this.ys.length; i++) {
			let segment = {'v': this.vs[i]};
			segment[this.isRelative ? 'ry' : 'y'] = this.ys[i] - this.iy;
			if(this.vfs[i] != this.vs[i]) segment.vf = this.vfs[i];

			segments.push(segment);
		}
		return segments;
	}
}

/// Helper class which parses KSH charts and stores parsed data in the KSHData class
class KSHParser {
	constructor(ksh) {
		this.ksh = ksh;
		this.currLineType = KSH_LINE_TYPE.HEADER;

		// Lines of measures, being read
		this.queue = [];
		// Lines of modifiers, which will be applied to the following line.
		this.modifiers = [];
	}
	readLine(line) {
		if(line === "") return;
		switch(this.currLineType) {
			case KSH_LINE_TYPE.HEADER:
				return this._readHeaderLine(line);
			case KSH_LINE_TYPE.BODY:
				return this._readBodyLine(line);
		}
	}
	end() {
		// If there's no `--` at the end, then the KSH file is malformed.
		// Let's gracefully add the last measure.
		if(this.queue.length > 0) {
			console.warn("Processing a KSH file with no `--` at the end...");
			this._onReadMeasure();
		}
	}
	_readHeaderLine(line) {
		if(line === "--") {
			this.currLineType = KSH_LINE_TYPE.BODY;
			return;
		}

		const match = line.match(KSH_REGEX.OPTION);
		if(match === null) return;

		const [key, value] = [match[1], match[2]];
		this.ksh.setKSHMeta(key, value);
	}
	_readBodyLine(line) {
		if(line === "--") {
			this._onReadMeasure();
			return;
		}

		// TODO: handle these later, if possible (custom FX effects)
		if(line[0] === '#') return;

		let match = line.match(KSH_REGEX.OPTION);
		if(match) {
			this.modifiers.push([match[1], match[2]]);
			return;
		}

		match = line.match(KSH_REGEX.LINE);
		if(match) {
			this.queue.push(new KSHLine(match, this.modifiers));
			this.modifiers = [];
			return;
		}
	}
	_onReadMeasure() {
		this.ksh.addKSHMeasure(this.queue);
		this.queue = [];
	}
}

/// Main KSH chart class, reading KSH charts and convert it to internal representation(KSON)
class KSHData extends VChartData {
	constructor(str) {
		super();

		this.parser = new KSHParser(this);
		this._ksmMeta = {
			'version': "ksh",
		};
		this._ksmMeasures = [];

		str.split('\n').map((line) => this.parser.readLine(line.replace(/^[\r\n\uFEFF]+|[\r\n]+$/g, '')));
		this.parser.end();

		this._setKSONData();
	}

	setKSHMeta(key, value) {
		this._ksmMeta[key] = value;
	}

	addKSHMeasure(measure) {
		this._ksmMeasures.push(measure);
	}

	_getDiffIdx() {
		switch((this._ksmMeta.difficulty || "").trim().toLowerCase()) {
			case 'light': return 0;
			case 'challenge': return 1;
			case 'extended': return 2;
			case 'infinite': return 3;
			default: return 3;
		}
	}

	/// Fills VChartData data
	_setKSONData() {
		this._setKSONVersion();
		this._setKSONMeta();
		this._setKSONBgmInfo();

		if('total' in this._ksmMeta) {
			let total = parseInt(this._ksmMeta.total);
			if(!isFinite(total)) throw new Error("Invalid ksh `total` value!");
			if(total < 100) total = 100;
			this.gauge = {'total': total};
		}

		this._setKSONBeatInfo();
		this._setKSONNoteInfo();
	}
	_setKSONVersion() {
		const ver = (this._ksmMeta.ver || "").trim();
		this.version = ver ? `ksh ${ver}` : "ksh";
	}
	_setKSONMeta() {
		const meta = this.meta = {};
		const ksmMeta = this._ksmMeta;

		meta.title = ksmMeta.title || "";
		meta.artist = ksmMeta.artist || "";
		meta.chart_author = ksmMeta.effect || "";
		meta.level = ((level) => !isFinite(level) || level < 1 ? 1 : level > 20 ? 20 : level)(parseInt(ksmMeta.level || 1));
		meta.difficulty = {'idx': this._getDiffIdx()};

		if('difficulty' in ksmMeta) meta.difficulty.name = ksmMeta.difficulty;
		if('t' in ksmMeta) meta.disp_bpm = ksmMeta.t;
		if('to' in ksmMeta) {
			meta.std_bpm = parseFloat(ksmMeta.to);
			if(!isFinite(meta.std_bpm) || meta.std_bpm < 0)
				throw new Error("Invalid ksh `to` value!");
		}
		if('jacket' in ksmMeta) meta.jacket_filename = ksmMeta.jacket;
		if('illustrator' in ksmMeta) meta.jacket_author = ksmMeta.illustrator;
		if('information' in ksmMeta) meta.information = ksmMeta.information;
	}
	_setKSONBgmInfo() {
		const bgmInfo = this.audio.bgm = {};
		const ksmMeta = this._ksmMeta;

		if('m' in ksmMeta) {
			const m = ksmMeta.m.split(';')[0];
			if(m !== "") bgmInfo.filename = m;
		}
		if('mvol' in ksmMeta) {
			const mvol = parseInt(ksmMeta.mvol);
			if(isFinite(mvol) && mvol != 100 && mvol >= 0) bgmInfo.vol = mvol;
		}
		if('o' in ksmMeta) {
			const offset = parseInt(ksmMeta.o);
			if(isFinite(offset) && offset != 0) bgmInfo.offset = offset;
		}
		if('po' in ksmMeta) {
			const preview_offset = parseInt(ksmMeta.po);
			if(isFinite(preview_offset) && preview_offset > 0) bgmInfo.preview_offset = preview_offset;
		}
		if('plength' in ksmMeta) {
			const preview_duration = parseInt(ksmMeta.plength);
			if(isFinite(preview_duration) && preview_duration > 0) bgmInfo.preview_duration = preview_duration;
		}
	}
	/// Processes timing of the chart, and computes `tick` and `len` of each line
	_setKSONBeatInfo() {
		const beatInfo = this.beat = {
			'bpm': new AATree(),
			'time_sig': [],
			'scroll_speed': new AATree(),
			'resolution': KSH_DEFAULT_MEASURE_TICK / 4
		};
		const ksmMeta = this._ksmMeta;

		if('t' in ksmMeta) {
			const initBPM = parseFloat(ksmMeta.t);
			if(initBPM <= 0 || !isFinite(initBPM)) throw new Error("Invalid ksh init BPM!");
			beatInfo.bpm.add(0, 0, initBPM);
		}

		if('beat' in ksmMeta) {
			beatInfo.time_sig.push({'idx': 0, 'v': (new KSHTimeSig(ksmMeta.beat)).toKSON()});
		}

		let measure_tick = 0; // Tick of the current measure being processed
		let time_sig = [4, 4]; // Default time signature, which is the common time signature.

		this._ksmMeasures.forEach((measure, measure_idx) => {
			if(measure.length === 0) throw new Error("Malformed ksh measure!");

			// Check the timing signature of this measure.
			measure[0].mods.forEach(([key, value]) => {
				switch(key) {
					case 'beat':
						const newTimeSig = new KSHTimeSig(value);
						time_sig = newTimeSig.timeSig;
						beatInfo.time_sig.push({'idx': measure_idx, 'v': newTimeSig.toKSON()});
						break;
				}
			});

			const measure_len = (KSH_DEFAULT_MEASURE_TICK / time_sig[1]) * time_sig[0];
			if(measure_len % measure.length != 0)
				throw new Error("Invalid ksh measure line count!");
			const tick_per_line = measure_len / measure.length;

			measure.forEach((kshLine, line_idx) => {
				let tick = kshLine.tick = measure_tick + tick_per_line * line_idx;
				kshLine.len = tick_per_line;

				kshLine.mods.forEach(([key, value]) => {
					const intValue = parseInt(value);
					const floatValue = parseFloat(value);
					switch(key) {
						case 'beat':
							// `beat`s are already processed above.
							// If a `beat` is in the middle of a measure, then the chart is invalid.
							if(line_idx > 0) throw new Error("Invalid ksh time signature! [invalid location]");
							break;
						case 't':
							if(floatValue <= 0 || !isFinite(floatValue)) throw new Error("Invalid ksh BPM value!");
							beatInfo.bpm.add(tick, 0, floatValue);
							break;
						case 'stop':
							if(intValue <= 0 || !isFinite(intValue)) throw new Error("Invalid ksh stop length!");
							// TODO: add ScrollSpeedPoints
							break;
					}
				});
			});

			measure_tick += measure_len;
		});
	}
	/// Processes notes and lasers
	_setKSONNoteInfo() {
		const noteInfo = this.note = {'bt': [], 'fx': [], 'laser': []};
		this._initTreeArr(this.note.laser, 2);

		// Stores [start, len] long note infos
		let longInfo = {'bt': [null, null, null, null], 'fx': [null, null]};
		const cutLongNote = (type, lane) => {
			const lit = longInfo[type];
			if(lit[lane] === null) return;
			const result = this.addNote(type, lane, lit[lane][0], lit[lane][1]);
			if(!result[0]){
				throw new Error(`Invalid ksh long notes! (${result[1].y} and ${lit[lane][0]} at ${lane} collides)`);
			}
			lit[lane] = null;
		};
		const addLongInfo = (type, lane, y, l) => {
			const lit = longInfo[type];
			if(lit[lane] === null) lit[lane] = [y, 0];
			if(lit[lane][0] + lit[lane][1] != y) {
				throw new Error("Invalid ksh long notes!");
			}
			lit[lane][1] += l;
		};

		// Stores current laser segments and how wide should they be
		let laserSegments = [null, null];
		let laserRange = [1, 1];
		const cutLaserSegment = (lane) => {
			if(laserSegments[lane] === null) return;
			let laser = {'v': laserSegments[lane].toKSON()};
			if(laserSegments[lane].range !== 1) laser.wide = laserSegments[lane].range;
			noteInfo.laser[lane].add(laserSegments[lane].iy, laserSegments[lane].getLength(), laser);
			laserSegments[lane] = null;
		};
		const addLaserSegment = (lane, y, v) => {
			if(laserSegments[lane] === null)
				laserSegments[lane] = new KSHGraph(true, {'y': y, 'range': laserRange[lane], 'collapseTick': KSH_LASER_SLAM_TICK});
			laserSegments[lane].push(y, v);
		};

		this._ksmMeasures.forEach((measure) => {
			measure.forEach((kshLine) => {
				kshLine.mods.forEach(([key, value]) => {
					switch(key) {
						case 'laserrange_l':
							laserRange[0] = value === "2x" ? 2 : 1;
							break;
						case 'laserrange_r':
							laserRange[1] = value === "2x" ? 2 : 1;
							break;
					}
				});
				// BT
				for(let i=0; i<4; i++) {
					const c = kshLine.bt[i];
					if(c === '0' || c === '1') cutLongNote('bt', i);
					if(c === '0') continue;
					if(c === '1') {
						// Single short note
						this.addNote('bt', i, kshLine.tick, 0);
						continue;
					}
					addLongInfo('bt', i, kshLine.tick, kshLine.len);
				}
				// FX
				for(let i=0; i<2; i++) {
					const c = kshLine.fx[i];
					if(c === '0' || c === '2') cutLongNote('fx', i);
					if(c === '0') continue;
					if(c === '2') {
						// Single short note
						this.addNote('fx', i, kshLine.tick, 0)
						continue;
					}
					addLongInfo('fx', i, kshLine.tick, kshLine.len);
				}
				// Laser
				for(let i=0; i<2; i++) {
					const c = kshLine.laser[i];
					if(c === '-') {
						cutLaserSegment(i);
						continue;
					}
					if(c === ':') continue;

					const pos = KSH_LASER_VALUES.indexOf(c);
					if(pos === -1) throw new Error("Invalid ksh laser pos value!");

					addLaserSegment(i, kshLine.tick, pos/50);
				}
			});
		});

		for(let i=0; i<4; ++i) cutLongNote('bt', i);
		for(let i=0; i<2; ++i) cutLongNote('fx', i);
		for(let i=0; i<2; ++i) cutLaserSegment(i);
	}
}

KSHData.create = function KSHData$create(file) {
	try {
		const ksh = new KSHData(file);
		return ksh;
	} catch(e) {
		console.error(e);
		return null;
	}
};

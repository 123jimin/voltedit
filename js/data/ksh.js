const KSH_LINE_TYPE = Object.freeze({'HEADER': 0, 'BODY': 1});
const KSH_REGEX = Object.freeze({
	'OPTION': /^([^=]+)=(.*)$/,
	'LINE': /^([012]{4})\|(.{2})\|([0-9A-Za-o\-:]{2})((?:@\(|@\)|@<|@>|S<|S>)[0-9;]+)?$/
});

const KSH_FX_EFFECTS = Object.freeze({
	'R': "Retrigger;4",
	'S': "Retrigger;8",
	'V': "Retrigger;12",
	'T': "Retrigger;16",
	'W': "Retrigger;24",
	'U': "Retrigger;32",
	'G': "Gate;4",
	'H': "Gate;8",
	'K': "Gate;12",
	'I': "Gate;16",
	'L': "Gate;24",
	'J': "Gate;32",
	'F': "Flanger",
	'P': "PitchShift",
	'B': "BitCrusher",
	'Q': "Phaser",
	'X': "Wobble;12",
	'A': "TapeStop",
	'D': "SideChain",
});

/// Just a data class representing time signatures
class KSHTimeSig {
	constructor(str) {
		const timeSig = this.timeSig = str.split('/').map((x) => parseInt(x));
		if(timeSig.length != 2 || timeSig.some((x) => !isFinite(x) || x < 1))
			throw new Error(L10N.t('ksh-import-error-value', 'beat', -1));
		if(KSH_DEFAULT_MEASURE_TICK % timeSig[1] != 0)
			throw new Error(L10N.t('ksh-import-error-value', 'beat', -1));
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
	readLine(line, lineNumber) {
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
			logger.warn(L10N.t('ksh-import-warn-no-trailing-dashes'));
			this._onReadMeasure();
		}
	}
	_readHeaderLine(line) {
		if(line === "--") {
			this.currLineType = KSH_LINE_TYPE.BODY;
			return;
		}
		if(line.startsWith("//")) {
			return;
		}

		const match = line.match(KSH_REGEX.OPTION);
		if(!match) throw new Error(L10N.t('ksh-import-error-invalid-header'));

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

		const parser = new KSHParser(this);
		this._ksmMeta = {
			'ver': "",
		};
		this._ksmMeasures = [];

		str.split('\n').map((line, i) =>
			parser.readLine(line.replace(/^[\r\n\uFEFF]+|[\r\n]+$/g, ''), i+1));
		parser.end();

		this._setKSONData();

		delete this._ksmMeta;
		delete this._ksmMeasures;
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
			default: return 4;
		}
	}

	/// Fills VChartData data
	_setKSONData() {
		this._initNote();
		this._setKSONVersion();
		this._setKSONMeta();
		this._setKSONBgmInfo();
		this._setKSONBgInfo();

		if('total' in this._ksmMeta) {
			let total = parseFloat(this._ksmMeta.total);
			if(!isFinite(total)) throw new Error(L10N.t('ksh-import-error-value', 'total', -1));
			if(total < 100) total = 100;
			this.gauge = {'total': total};
		}

		// Yes, KSM file is read multiple times.
		// But currently reading time is dominated by rendering time, so let's ignore this problem for now.
		this._setKSONFromKSHLineOps();
		this._setKSONNoteInfo();
		this._setKSONRotationInfo();
	}
	_setKSONVersion() {
		this.version = CURR_KSON_VERSION;
	}
	_setKSONMeta() {
		const meta = this.meta = {};
		const ksmMeta = this._ksmMeta;

		meta.title = ksmMeta.title || "";
		meta.artist = ksmMeta.artist || "";
		meta.chart_author = ksmMeta.effect || "";
		meta.level = CLIP(parseInt(ksmMeta.level || 1), 1, 20);
		meta.difficulty = {'idx': this._getDiffIdx()};

		if('difficulty' in ksmMeta) meta.difficulty.name = ksmMeta.difficulty;
		if('t' in ksmMeta) meta.disp_bpm = ksmMeta.t;
		if('to' in ksmMeta) {
			meta.std_bpm = parseFloat(ksmMeta.to);
			if(!isFinite(meta.std_bpm) || meta.std_bpm <= 0)
				throw new Error(L10N.t('ksh-import-error-value', 'to', -1));
		}
		if('jacket' in ksmMeta) meta.jacket_filename = ksmMeta.jacket;
		if('illustrator' in ksmMeta) meta.jacket_author = ksmMeta.illustrator;
		if('information' in ksmMeta) meta.information = ksmMeta.information;

		meta.ksh_version = ksmMeta.ver;

		if(('title_img' in ksmMeta) || ('artist_img' in ksmMeta)){
			const legacyMeta = this['meta.legacy'] = {};
			if('title_img' in ksmMeta) legacyMeta.title_img = ksmMeta.title_img;
			if('artist_img' in ksmMeta) legacyMeta.artist_img = ksmMeta.artist_img;
		}

		if('chokkakuautovol' in ksmMeta){
			const legacyAudio = this['audio.legacy'] = {};
			legacyAudio.laser_slam_auto_vol = parseInt(ksmMeta.chokkakuautovol);
		}
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
	_setKSONBgInfo() {
		const legacyInfo = {};
		const ksmMeta = this._ksmMeta;

		this.bg = {'legacy': legacyInfo};

		if('bg' in ksmMeta) legacyInfo.bg = ksmMeta.bg.split(';').map((s) => ({'filename': s}));
		if('layer' in ksmMeta){
			const separator = GET_KSH_VER(ksmMeta.ver) >= 166 ? ';' : '/';
			const arr = ksmMeta.layer.split(separator);
			const layer = {'filename': arr[0], 'duration': +arr[1]};
			if(arr.length >= 3){
				const v = +arr[2];
				layer.rotation = {'tilt':!!(v&1), 'spin':!!(v&2)};
			}

			legacyInfo.layer = [layer];
		}

		if('v' in ksmMeta || 'vo' in ksmMeta){
			const movieInfo = {};
			if('v' in ksmMeta) movieInfo.filename = ksmMeta.v;
			if('vo' in ksmMeta) movieInfo.offset = parseInt(ksmMeta.vo);
			legacyInfo.movie = movieInfo;
		}
	}
	/// Processes timing of the chart, computes `tick` and `len` of each line,
	/// and process options of each line to fill KSON data.
	_setKSONFromKSHLineOps() {
		const beatInfo = this.beat = {
			'bpm': new AATree(),
			'time_sig': [],
			'resolution': KSH_DEFAULT_MEASURE_TICK / 4
		};
		this.camera = null;

		const ksmMeta = this._ksmMeta;

		if('beat' in ksmMeta) {
			beatInfo.time_sig.push({'idx': 0, 'v': (new KSHTimeSig(ksmMeta.beat)).toKSON()});
		}

		let measure_tick = 0; // Tick of the current measure being processed
		let time_sig = [4, 4]; // Default time signature, which is the common time signature.

		this._ksmMeasures.forEach((measure, measure_idx) => {
			if(measure.length === 0)
				throw new Error(L10N.t('ksh-import-error-malformed-measure', measure_idx));

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
				throw new Error(L10N.t('ksh-import-error-invalid-measure-line-count', measure_idx));
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
							if(line_idx > 0)
								throw new Error(L10N.t('ksh-import-error-invalid-time-sig-location', measure_idx));
							break;
						case 't':
							if(tick > 0) this._tryAddBPMFromMeta();
							if(floatValue <= 0 || !isFinite(floatValue))
								throw new Error(L10N.t('ksh-import-error-value', 't(BPM)', measure_idx));
							beatInfo.bpm.add(tick, 0, floatValue);
							break;
						case 'stop':
							if(intValue <= 0 || !isFinite(intValue))
								throw new Error(L10N.t('ksh-import-error-value', 'stop', measure_idx));
							const graph = new VGraphSegment(true, {'y': tick});
							graph.pushKSH(tick, 0);
							graph.pushKSH(tick+intValue, 0);

							this.addScrollSpeedSegment(graph);
							break;
						case 'zoom_bottom':
							this._addZoom('zoom', tick, value, measure_idx);
							break;
						case 'zoom_side':
							this._addZoom('shift_x', tick, value, measure_idx);
							break;
						case 'zoom_top':
							this._addZoom('rotation_x', tick, value, measure_idx);
							break;
					}
				});
			});

			measure_tick += measure_len;
		});

		// Add one to BPM if there's no BPM change
		this._tryAddBPMFromMeta();
	}
	_tryAddBPMFromMeta() {
		if(this.beat.bpm.size === 0 && 't' in this._ksmMeta){
			const initBPM = this._ksmMeta.t;
			if(initBPM.match(/^[\d.]+$/)) {
				this.addBPM(0, parseFloat(initBPM));
			}
		}
	}
	_addZoom(type, tick, value, measure_idx) {
		value = parseInt(value);
		if(!isFinite(value))
			throw new Error(L10N.t('ksh-import-error-value', 'zoom', measure_idx));
		value /= 100;

		const zoom = this.getCamBodyData(type);
		if(zoom.size > 0){
			const lastPoint = zoom.last();
			if(lastPoint.y === tick){
				lastPoint.data.vf = value;
				return;
			}
		}
		const point = new VGraphPoint({'v': value, 'connected': true});
		zoom.add(tick, 0, point);
	}

	/// Processes notes and lasers
	_setKSONNoteInfo() {
		// Stores [start, len] long note infos
		let longInfo = {'bt': [null, null, null, null], 'fx': [null, null]};

		// Stores [start, effect] FX audio effects
		let fxAudioEffects = [null, null];
		NOP(fxAudioEffects);

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
		let laserWide = [1, 1];
		const cutLaserSegment = (lane) => {
			if(laserSegments[lane] === null) return;

			this.addLaserSegment(lane, laserSegments[lane]);
			laserSegments[lane] = null;
			laserWide[lane] = 1;
		};
		const addLaserSegment = (lane, y, v) => {
			if(laserSegments[lane] === null)
				laserSegments[lane] = new VGraphSegment(true, {'y': y, 'wide': laserWide[lane]});
			laserSegments[lane].pushKSH(y, v, true);
		};

		this._ksmMeasures.forEach((measure) => {
			measure.forEach((kshLine) => {
				kshLine.mods.forEach(([key, value]) => {
					switch(key) {
						case 'laserrange_l':
							laserWide[0] = value === "2x" ? 2 : 1;
							break;
						case 'laserrange_r':
							laserWide[1] = value === "2x" ? 2 : 1;
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
					if(pos === -1) throw new Error(L10N.t('ksh-import-error-invalid-laser-pos'));

					addLaserSegment(i, kshLine.tick, pos/50);
				}
			});
		});

		for(let i=0; i<4; ++i) cutLongNote('bt', i);
		for(let i=0; i<2; ++i) cutLongNote('fx', i);
		for(let i=0; i<2; ++i) cutLaserSegment(i);
	}

	_setKSONRotationInfo() {
		this._ksmMeasures.forEach((measure, measure_idx) => {
			measure.forEach((kshLine) => {
				if(!kshLine.rot) return;
				this._addRotation(kshLine.tick, kshLine.rot, measure_idx);
			});
		});
	}
	_addRotation(tick, mod, measure_idx) {
		const type = mod.slice(0, 2);
		const args = mod.slice(2).split(';').map((x) => parseInt(x));

		let invokeName = '', invokeScale = 1;
		switch(type){
			case '@(': [invokeName, invokeScale] = ['spin', -1]; break;
			case '@)': [invokeName, invokeScale] = ['spin', +1]; break;
			case '@<': [invokeName, invokeScale] = ['half_spin', -1]; break;
			case '@>': [invokeName, invokeScale] = ['half_spin', +1]; break;
			case 'S<': [invokeName, invokeScale] = ['swing', -1]; break;
			case 'S>': [invokeName, invokeScale] = ['swing', +1]; break;
			default: return;
		}

		for(let lane of [0, 1]){
			const laser = this.getLaserNode(lane, tick);

			// To suppress warnings
			NOP(args, laser);
		}

		// TODO: which lane?
	}
}

KSHData.create = function KSHData$create(file) {
	try {
		const ksh = new KSHData(file);
		return ksh;
	} catch(e) {
		logger.error(e);
		return null;
	}
};

KSHData.toKSH = function KSHData$toKSH(chart) {
	return (new KSHExporter(chart)).export();
};

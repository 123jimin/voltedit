/// Util class for managing exporting to KSH
const KSH_VERSIONS = new Set(" 120 120b 121 130 166 167".split(' '));
class KSHExporter {
	constructor(chart) {
		this.chart = chart;
		this.lines = [];

		if(!chart.beat || chart.beat.resolution !== KSH_DEFAULT_MEASURE_TICK/4){
			throw new Error("Exporting to KSH is not supported when the resolution is not 48.");
		}

		this.nextBtNotes = null;
		this.nextFxNotes = null;
		this.nextLasers = null;

		this.nextBPM = null;
	}
	putLine(l) {
		this.lines.push(l);
	}
	putProperty(k, v) {
		if(v != null) this.putLine(`${k}=${v}`);
	}
	putHeader() {
		const chart = this.chart;
		const p = this.putProperty.bind(this);

		p('title', chart.meta.title || "");
		p('artist', chart.meta.artist);
		// TODO: title_img, artist_img
		p('effect', chart.meta.chart_author);
		p('jacket', chart.meta.jacket_filename);
		p('illustrator', chart.meta.jacket_author);
		p('difficulty', this.getDifficulty());
		p('level', chart.meta.level);
		p('t', this.getBPM());
		p('to', chart.meta.std_bpm);

		const bgmInfo = chart.audio && chart.audio.bgm || null;
		if(bgmInfo){
			p('m', bgmInfo.filename);
			p('mvol', bgmInfo.vol);
			p('o', bgmInfo.offset);
			p('po', bgmInfo.preview_offset);
			p('plength', bgmInfo.preview_duration);

			if(bgmInfo.preview_filename != null){
				console.warn("The chart contains preview_filename, which can't be represented in KSH.");
			}
		}

		const legacyBGInfo = chart.bg && chart.bg.legacy || null;
		if(legacyBGInfo) {
			if(legacyBGInfo.bg) p('bg', legacyBGInfo.bg.map((bg) => bg.filename).join(';'));
			if(legacyBGInfo.layer) p('layer', legacyBGInfo.layer.map((layer) => {
				const rotation = layer.rotation ?
					(layer.rotation.tilt ? 1 : 0) + (layer.rotation.spin ? 2 : 0) : 0;
				return `${layer.filename};${layer.duration};${rotation}`;
			})[0]);

			if(legacyBGInfo.movie) {
				p('v', legacyBGInfo.movie.filename);
				p('vo', legacyBGInfo.movie.offset);
			}
		}

		p('total', chart.gauge && chart.gauge.total);
		// TODO: chokkakuautovol, pfilterdelay
		p('ver', this.getVersion(chart.version));
		p('information', chart.meta.information);
	}
	getVersion() {
		const version = this.chart.version;
		if(KSH_VERSIONS.has(version)) return version;
		return "167";
	}
	getBPM() {
		const bpm = this.chart.beat.bpm;

		if(!bpm || bpm.size === 0) return null;
		if(bpm.size === 1){
			return `${bpm.first().data}`;
		}
		let min_bpm = 0, max_bpm = 0;
		bpm.traverse((node) => {
			if(min_bpm === 0){
				min_bpm = node.data;
			}
			min_bpm = Math.min(min_bpm, node.data);
			max_bpm = Math.max(max_bpm, node.data);
		});
		return `${min_bpm}-${max_bpm}`;
	}
	getDifficulty() {
		return ['light','challenge','extended','infinite'][this.chart.meta.difficulty.idx||0];
	}
	putBody() {
		let prevN = 0, prevD = 0;
		const note = this.chart.note;
		const getFirst = (arr, lane) => lane < arr.length ? arr[lane].first() : null;

		this.nextBtNotes = [0, 1, 2, 3].map((lane) => getFirst(note.bt, lane));
		this.nextFxNotes = [0, 1].map((lane) => getFirst(note.fx, lane));
		this.nextLasers = [0, 1].map((lane) => getFirst(note.laser, lane));
		this.nextBPM = this.chart.beat && this.chart.beat.bpm ? this.chart.beat.bpm.first() : null;

		this.chart.iterMeasures((measureIndex, measureTick, n, d, measureLength) => {
			// beat
			if(n !== prevN || d !== prevD) {
				this.putProperty('beat', `${n}/${d}`);
				[prevN, prevD] = [n, d];
			}
			this.putMeasure(measureIndex, measureTick, measureLength);
		});
	}
	putMeasure(measureIndex, measureTick, measureLength) {
		const chart = this.chart;
		let tickSize = KSH_DEFAULT_MEASURE_TICK;
		const measureEnd = measureTick+measureLength;

		const getTrees = (arr, count) => {
			const result = arr ? arr.map((tree) => tree.getAll(measureTick, measureLength)) : [];
			while(result.length < count) result.push([]);
			while(result.length > count) result.pop();
			return result;
		};
		const updateTickSize = (t) => { if(measureTick <= t && t < measureEnd) tickSize = GCD(tickSize, t); };
		const updateTickSizeNodes = (nodes) => nodes.forEach((node) => {
			updateTickSize(node.y); node.l && updateTickSize(node.y+node.l);
		});
		const updateTickSizeNote = (tickSize, arr, start, end) => {
			arr.forEach(updateTickSizeNodes);
		};

		// ticks
		const btNotes = getTrees(chart.note.bt, 4);
		const fxNotes = getTrees(chart.note.fx, 2);
		const lasers = getTrees(chart.note.laser, 2);

		// Determine tick size
		updateTickSizeNote(tickSize, btNotes);
		updateTickSizeNote(tickSize, fxNotes);

		chart.beat && chart.beat.bpm && updateTickSizeNodes(chart.beat.bpm.getAll(measureTick, measureLength));
		// TODO: check lasers and other stuffs

		// Print each line
		for(let i=measureTick; i<measureEnd; i+=tickSize){
			if(this.nextBPM && this.nextBPM.y == i){
				this.putProperty('t', this.nextBPM.data);
				this.nextBPM = this.nextBPM.next();
			}

			const btStr = this._getNoteStr(i, btNotes, this.nextBtNotes, '1', '2');
			const fxStr = this._getNoteStr(i, fxNotes, this.nextFxNotes, '2', '1');
			const laserStr = this._getLaserStr(i);
			this.putLine(`${btStr}|${fxStr}|${laserStr}`);
		}

		this.putLine("--");
	}
	_getLaserStr() {
		return '--';
	}
	_getNoteStr(tick, notes, nextNotes, shortNote, longNote) {
		return notes.map((laneNotes, lane) => {
			const nextNote = nextNotes[lane];
			if(!nextNote) return '0';
			if(tick < nextNote.y) return '0';
			if(nextNote.l){
				if(nextNote.y+nextNote.l === tick){
					nextNotes[lane] = nextNote.next();
					return '0';
				}else{
					return longNote;
				}
			}else{
				nextNotes[lane] = nextNote.next();
				return shortNote;
			}
		}).join('');
	}
	export() {
		this.lines = [];
		this.putHeader();
		this.putLine('--');
		this.putBody();
		return '\uFEFF'+this.lines.join('\r\n');
	}
}
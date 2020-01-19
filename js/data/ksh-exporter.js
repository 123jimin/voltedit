/// Util class for managing exporting to KSH
const KSH_VERSIONS = new Set(" 120 120b 121 130 166 167".split(' '));
class KSHExporter {
	constructor(chart) {
		this.chart = chart;
		this.lines = [];

		if(!chart.beat || chart.beat.resolution !== KSH_DEFAULT_MEASURE_TICK/4){
			throw new Error(L10N.t('ksh-export-error-resolution', KSH_DEFAULT_MEASURE_TICK/4));
		}

		this.nextBtNotes = null;
		this.nextFxNotes = null;
		this.nextLasers = null;
		this.nextLaserSlams = null;

		this.nextBPM = null;
		this.nextScrollSpeed = null;
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
				logger.warn(L10N.t('ksh-export-warn-omitted', 'preview_filename'));
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
		const getFirst = (arr, lane) => arr && lane < arr.length ? arr[lane].first() : null;

		this.nextBtNotes = [0, 1, 2, 3].map((lane) => getFirst(note.bt, lane));
		this.nextFxNotes = [0, 1].map((lane) => getFirst(note.fx, lane));
		this.nextLasers = [0, 1].map((lane) => getFirst(note.laser, lane));
		this.nextLaserSlams = [[-1, null], [-1, null]];

		this.nextBPM = this.chart.beat && this.chart.beat.bpm ? this.chart.beat.bpm.first() : null;
		this.nextScrollSpeed = this.chart.beat && this.chart.beat.scroll_speed ? this.chart.beat.scroll_speed.first() : null;

		// TODO: currently for cameras, only `camera.cam.body.{zoom,shift_x,rotation_x}` are considered for now.
		// `camra.cam.body.lane_*`, `camera.cam.body.jdgline_*`, and `camera.cam.pattern.*` should also be considered in future.
		this.nextCamBodies = {};
		
		if(this.chart.camera){
			if(this.chart.camera.cam){
				const cam = this.chart.camera.cam;
				if(cam.body){
					for(let key in cam.body){
						if(!cam.body[key]) continue;
						this.nextCamBodies[key] = cam.body[key].points.first();
					}
				}
			}
		}

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
		let tickSize = measureLength;
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
		const updateTickSizeNote = (arr) => {
			arr.forEach(updateTickSizeNodes);
		};
		const updateTickSizeGraphs = (graphs, collapse) => {
			graphs.forEach((graph) => {
				const minResolution = graph.data.getMinResolution(measureTick, measureLength, collapse);
				tickSize = GCD(tickSize, minResolution);
			});
		};
		const updateTickSizeLasers = (arr) => {
			arr.forEach((graphs) => updateTickSizeGraphs(graphs, true));
		};

		// ticks
		const btNotes = getTrees(chart.note.bt, 4);
		const fxNotes = getTrees(chart.note.fx, 2);
		const lasers = getTrees(chart.note.laser, 2);

		// Determine tick size
		updateTickSizeNote(btNotes);
		updateTickSizeNote(fxNotes);
		updateTickSizeLasers(lasers);

		if(chart.beat){
			chart.beat.bpm && updateTickSizeNodes(chart.beat.bpm.getAll(measureTick, measureLength));
			chart.beat.scroll_speed && updateTickSizeGraphs(chart.beat.scroll_speed.getAll(measureTick, measureLength));
		}

		if(chart.camera){
			if(chart.camera.cam){
				const cam = chart.camera.cam;
				if(cam.body){
					for(let key in cam.body){
						if(!cam.body[key]) continue;
						tickSize = GCD(tickSize, cam.body[key].getMinResolution(measureTick, measureLength));
					}
				}
			}
		}

		// Print each line
		for(let i=measureTick; i<measureEnd; i+=tickSize){
			if(this.nextBPM && this.nextBPM.y == i){
				this.putProperty('t', this.nextBPM.data);
				this.nextBPM = this.nextBPM.next();
			}

			this._putStopStr(i);
			
			this._putZooms('zoom', 'zoom_bottom', i);
			this._putZooms('shift_x', 'zoom_side', i);
			this._putZooms('rotation_x', 'zoom_top', i);

			const btStr = this._getNoteStr(i, btNotes, this.nextBtNotes, '1', '2');
			const fxStr = this._getNoteStr(i, fxNotes, this.nextFxNotes, '2', '1');
			const laserStr = this._getLaserStr(i, 0) + this._getLaserStr(i, 1);
			this.putLine(`${btStr}|${fxStr}|${laserStr}`);
		}

		this.putLine("--");
	}
	_putStopStr(tick) {
		if(!this.nextScrollSpeed || tick < this.nextScrollSpeed.y) return;

		if(tick >= this.nextScrollSpeed.y + this.nextScrollSpeed.l){
			this.nextScrollSpeed = this.nextScrollSpeed.next();
			if(!this.nextScrollSpeed) return;
		}

		const point = this.nextScrollSpeed.data.points.get(tick-this.nextScrollSpeed.data.iy);
		if(!point) return;

		let nextPoint = point.next();
		if(!nextPoint) return;

		if(point.data.vf !== nextPoint.data.v){
			logger.warn("Non-constant scroll_speed can't be represented in KSH.");
			return;
		}

		if(point.data.vf === 1) return;
		if(point.data.vf !== 0){
			logger.warn("Non-zero scroll_speed can't be represented in KSH.");
			return;
		}

		// Condense multiple flat points into one
		while(nextPoint.data.v === nextPoint.data.vf){
			let nextNext = nextPoint.next();
			if(!nextNext) break;
			if(nextNext.data.v !== point.data.vf) break;
			nextPoint = nextNext;
		}

		this.putProperty('stop', nextPoint.y - point.y);
	}
	_putZooms(from, to, tick) {
		const point = this.nextCamBodies[from];
		if(!point || tick < point.y) return;

		const nextPoint = point.next();
		// Do not include the trivial start point
		if(point.y > 0 || point.data.isSlam() || !nextPoint || point.data.vf !== nextPoint.v){
			const v = RD(point.data.v*100);
			this.putProperty(to, v);
			
			if(point.data.isSlam()){
				const vf = RD(point.data.vf*100);
				this.putProperty(to, vf);
			}
		}

		this.nextCamBodies[from] = nextPoint;
	}
	_getLaserStr(tick, lane) {
		const nextLaserSlam = this.nextLaserSlams[lane];
		if(tick < nextLaserSlam[0]) return ':';
		if(tick === nextLaserSlam[0]){
			return nextLaserSlam[1];
		}

		const nextLaser = this.nextLasers[lane];
		if(!nextLaser || tick < nextLaser.y) return '-';

		if(tick === nextLaser.y){
			if(nextLaser.data.wide !== 1)
				this.putProperty(`laserrange_${'lr'[lane]}`, `${nextLaser.data.wide}x`);
		}

		const point = nextLaser.data.points.get(tick-nextLaser.data.iy);
		if(tick === nextLaser.y+nextLaser.l){
			this.nextLasers[lane] = nextLaser.next();
		}

		if(!point) return ':';


		if(point.data.isSlam()){
			nextLaserSlam[0] = tick+KSH_LASER_SLAM_TICK;
			nextLaserSlam[1] = point.data.toKSH(true);
		}
		return point.data.toKSH(false);
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
		console.time("Computing KSH");
		this.putHeader();
		this.putLine('--');
		this.putBody();
		console.timeEnd("Computing KSH");
		return '\uFEFF'+this.lines.join('\r\n');
	}
}

class KSONData extends VChartData {
	/// Assumes that `obj` will be owned by this object.
	constructor(obj) {
		super();

		this._setVersion(obj);
		this._setMeta(obj);
		this._setBeat(obj);
		this._setGauge(obj);
		this._setNote(obj);
		this._setAudio(obj);
		this._setCamera(obj);
		this._setBG(obj);
		this._setImpl(obj);
	}
	_setVersion(obj) {
		// TODO: gracefully handle this case by adding custom version string
		if(obj.version == null) throw new Error("Invalid kson! [invalid version]");
		this.version = obj.version.toString();
	}
	_setMeta(obj) {
		// TODO: gracefully handle this case by adding custom meta
		if(!obj.meta) throw new Error("Invalid kson! [invalid meta]");
		// TODO: validate the values (gracefully)
		this.meta = obj.meta;
	}
	_setBeat(obj) {
		// No generousity in this case!
		if(!obj.beat) throw new Error("Invalid kson! [invalid beat]");

		const objBeat = obj.beat;
		this.beat = {
			'bpm': new AATree(),
			'resolution': 240
		};

		if(!('bpm' in objBeat)) throw new Error("Invalid kson! [invalid bpm]");
		objBeat.bpm.forEach((bpm) => this.addBPM(bpm.y, bpm.v));

		if(objBeat.time_sig){
			this.beat.time_sig = objBeat.time_sig;
		}

		if(objBeat.scroll_speed){
			objBeat.scroll_speed.forEach((data) => {
				const graph = new VGraph(true, {'y': data.y});
				data.v.forEach((point) => graph.pushKSON(point));
				this.addScrollSpeed(graph);
			});
		}

		if(objBeat.resolution){
			const objResolution = objBeat.resolution;
			if(!IS_POSITIVE_INT(objResolution)){
				throw new Error("Invalid kson! [invalid resolution]");
			}

			this.beat.resolution = objResolution;
		}
	}
	_setGauge(obj) {
		this.gauge = {};
		if(!obj.gauge) return;

		// TODO: validate the values (gracefully)
		if(!obj.gauge.total) return;
		this.gauge.total = obj.guage.total;
	}
	_setNote(obj) {
		this._initNote();

		if(!obj.note) return;

		if(obj.note.bt) obj.note.bt.forEach((notes, lane) => notes.forEach((note) => {
			this.addNote('bt', lane, note.y, note.l || 0);
		}));

		if(obj.note.fx) obj.note.fx.forEach((notes, lane) => notes.forEach((note) => {
			this.addNote('fx', lane, note.y, note.l || 0);
		}));

		if(obj.note.laser) obj.note.laser.forEach((lasers, lane) => lasers.forEach((data) => {
			const graph = new VGraph(true, {'wide': data.wide || 1, 'y': data.y});
			data.v.forEach((point) => graph.pushKSON(point));
			this.addLaser(lane, graph);
		}));
	}

	// Stuffs not yet implemented
	_setAudio(obj) {
		this.audio = {};
		if(!obj.audio) return;

		this.audio = obj.audio;
	}
	_setCamera(obj) {
		this.camera = {};
		if(!obj.camera) return;

		this.camera = obj.camera;
	}
	_setBG(obj) {
		this.bg = {};
		if(!obj.bg) return;

		this.bg = obj.bg;
	}
	_setImpl(obj) {
		this.impl = {};
		if(!obj.impl) return;

		this.impl = obj.impl;
	}
}

KSONData.create = function KSONData$create(file) {
	try {
		const fileObj = JSON.parse(file);

		// Check that essential fields are not missing.
		if(!('version' in fileObj)) return null;
		if(!('meta' in fileObj)) return null;
		if(!('beat' in fileObj)) return null;

		const kson = new KSONData(fileObj);

		return kson;
	} catch(e) {
		logger.error(e);
		return null;
	}
};

KSONData.toKSON = function KSONData$toKSON(chart) {
	return chart.toKSON();
};

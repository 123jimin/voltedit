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
	'LINE': /^([012]{4})\|(.{2})\|([0-9A-Za-o\-:]{2})(?:(@\(|@\)|@<|@>|S<|S>)(\d+))?$/
});

class KSHParser {
	constructor(ksh) {
		this.ksh = ksh;
		this.currLineType = KSH_LINE_TYPE.HEADER;
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
	_readHeaderLine(line) {
		if(line == "--") {
			this.currLineType = KSH_LINE_TYPE.BODY;
			return;
		}

		const match = line.match(KSH_REGEX.OPTION);
		if(match === null) return;

		const [key, value] = [match[1], match[2]];
		this.ksh.setKSHMeta(key, value);
	}
	_readBodyLine(line) {
	}
}

class KSHData extends VChartData {
	constructor(str) {
		super();

		this.parser = new KSHParser(this);
		this._ksmMeta = {
			'version': "ksh",
		};

		str.split('\n').map((line) => this.parser.readLine(line.replace(/^[\r\n\uFEFF]+|[\r\n]+$/g, '')));

		this._setKSONVersion();
		this._setKSONMeta();
		this._setKSONBgmInfo();
	}

	setKSHMeta(key, value) {
		this._ksmMeta[key] = value;
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

const CURR_KSON_VERSION = "0.0.0";
const CURR_KSH_VERSION = "167";

const KSH_DEFAULT_MEASURE_TICK = 192;
const KSH_LASER_SLAM_TICK = KSH_DEFAULT_MEASURE_TICK / 32;
const KSH_LASER_VALUES = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmno";
const KSH_LASER_LOOKUP = Object.freeze(((str) => {
	const dict = {};
	for(let i=0; i<str.length; ++i) dict[str[i]] = i;
	return dict;
})(KSH_LASER_VALUES));
const KSH_VERSIONS = Object.freeze({
	"": 0,
	"120": 120,
	"120b": 120,
	"121": 121,
	"130": 130,
	"166": 166,
	"167": 167,
});

const GET_KSH_VER = (str) => (str in KSH_VERSIONS) ? KSH_VERSIONS[str] : 0;

/// For experimental compact storage of Interval[]
const INTERVAL_INFLATE = (arr, callback) => {
	let y = 0;
	let diff = 0;
	for(let i=0; i<arr.length; ++i){
		if(arr[i] > 0){
			diff = arr[i];
		}
		y += diff;
		let l = 0;
		if(i+1 < arr.length && arr[i+1] < 0){
			l = -arr[i+1];
			++i;
		}
		callback(y, l);
		y += l;
	}
};
const INTERVAL_DEFLATE = (tree) => {
	const arr = [];
	let last = 0;
	let lastDiff = 0;
	tree.traverse((node) => {
		const diff = node.y - last;
		if(diff === lastDiff){
			arr.push(0);
		}else{
			arr.push(diff);
			lastDiff = diff;
		}
		last = node.y;
		if(node.l){
			arr.push(-node.l);
			last += node.l;
		}
	});
	return arr;
};
const READ_INTERVAL_ARR = (arr, callback) => {
	if(window.TEST_COMPACT){
		INTERVAL_INFLATE(arr, callback);
	}else{
		arr.forEach((note) => {
			callback(note.y, note.l || 0);
		});
	}
};
const WRITE_INTERVAL_ARR = (tree) => {
	if(window.TEST_COMPACT){
		return INTERVAL_DEFLATE(tree);
	}else{
		const arr = [];
		tree.traverse((node) => {
			const obj = {'y': node.y};
			if(node.l) obj.l = node.l;
			arr.push(obj);
		});
		return arr;
	}
};

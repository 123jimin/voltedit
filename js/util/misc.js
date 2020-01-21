/// JS file containing misc util functions

const NOP = () => {};
const GCD = (a, b) => a === 0 ? b : b === 0 ? a : a === 1 || b === 1 ? 1 : GCD(b, a%b);
const LCM = (a, b) => (a/GCD(a, b))*b;

const TODO = () => { throw new Error(L10N.t('not-yet-implemented')); };

// const SIGN = (x) => { x < 0 ? -1 : x > 0 ? 1 : 0; };
const IS_POSITIVE_INT = (x) => isFinite(x) && Number.isInteger(x) && x > 0;

/// Shorthand for Math.round()
const RD = Math.round;

/// Round to half-int
const RDH = (x) => RD(x+0.5)-0.5;

/// Clip to a range
const CLIP = (x, a, b) => x<a ? a : x>b ? b : !isFinite(x) ? a : x;

/// Align to the value
const ALIGN = (a, x) => x%a === 0 ? x : RD(x/a)*a;

/// Change the value, based on desired direction
const ALIGN_STEP = (a, orig, dir) => ALIGN(a, orig+dir*a);

/// Create a quad from 2D coordinates
const QUAD = (points, [ax, ay], [bx, by], [cx, cy], [dx, dy]) => points.push(
	ax, ay, 0, bx, by, 0, cx, cy, 0, ax, ay, 0, cx, cy, 0, dx, dy, 0
);

const RECT = (points, [ax, ay], [bx, by]) => QUAD(points, [ax, ay], [bx, ay], [bx, by], [ax, by]);

const RenderHelper = Object.freeze({
	'dispose': (elem) => {
		elem.parent.remove(elem);

		if(elem.userData){
			const disposeGeometry = !!(elem.userData._disposeGeometry);
			const disposeMaterial = !!(elem.userData._disposeMaterial);
			const checkDispose = (elem) => {
				elem.children.forEach(checkDispose);
				if('geometry' in elem && disposeGeometry) elem.geometry.dispose();
				if('material' in elem && disposeMaterial) elem.material.dispose();
			};

			checkDispose(elem);
		}
	},
	'clear': (elem) => {
		for(let i=elem.children.length; i-->0;) {
			RenderHelper.dispose(elem.children[i]);
		}
	},
	'updateGeometry': (obj, points) => {
		if(!obj.geometry && obj.children.length === 1)
			return RenderHelper.updateGeometry(obj.children[0], points);
		const geometry = obj.geometry;
		const geometry_position = geometry.attributes.position;
		points.forEach((value, ind) => geometry_position.array[ind] = value);
		geometry_position.needsUpdate = true;
		geometry.computeBoundingSphere();
	}
});

const TOUCH = (func) => (event) => {
	const changedTouches = event.changedTouches;
	if(!changedTouches || changedTouches.length < 1) return;
	func(changedTouches[0]);
};

const KEYCODE = (event) => {
	if('code' in event) return event.code;
	const which = event.which || event.keyCode || 0;
	if(!which) return "";

	if(which >= 48 && which <= 57){
		return `Digit${which-48}`;
	}
	if(which >= 65 && which <= 90){
		return `Key${String.fromCharCode(which)}`;
	}
	if(which >= 96 && which <= 105){
		return `Numpad${which-96}`;
	}
	if(which >= 112 && which <= 123){
		return `F${which-111}`;
	}
	const altLoc = 'location' in event && event.location > 1 ?
		event.location === 2 ? 'Right' : 'Numpad' : 'Left';
	switch(which){
		case 3: return 'Pause';
		case 8: return 'Backspace';
		case 9: return 'Tab';
		case 13: return altLoc === 'Numpad' ? "NumpadEnter" : "Enter";
		case 16: return `Shift${altLoc}`;
		case 17: return `Control${altLoc}`;
		case 18: return `Alt${altLoc}`;
		case 19: return 'Pause';
		case 20: return 'CapsLock';
		case 21: return 'AltRight';
		case 25: return 'ControlRight';
		case 27: return 'Escape';
		case 32: return 'Space';
		case 33: return 'PageUp';
		case 34: return 'PageDown';
		case 35: return 'End';
		case 36: return 'Home';
		case 37: return 'ArrowLeft';
		case 38: return 'ArrowUp';
		case 39: return 'ArrowRight';
		case 40: return 'ArrowBottom';
		case 45: return 'Insert';
		case 46: return 'Delete';
		case 91: return 'MetaLeft';
		case 144: return 'NumLock';
		case 145: return 'ScrollLock';
		case 172: return 'BrowserHome';
		case 173: return 'AudioVolumeMute';
		case 174: return 'AudioVolumeDown';
		case 175: return 'AudioVolumeUp';
		case 176: return 'MediaTrackNext';
		case 177: return 'MediaTrackPrevious';
		case 178: return 'MediaStop';
		case 179: return 'MediaPlayPause';
		case 180: return 'LaunchMail';
		case 186: return 'Semicolon';
		case 187: return 'Equal';
		case 188: return 'Comma';
		case 189: return 'Minus';
		case 190: return 'Period';
		case 191: return 'Slash';
		case 192: return 'Backquote';
		case 219: return 'BracketLeft';
		case 220: return 'Backslash';
		case 221: return 'BracketRight';
		case 222: return 'Quote';
	}

	return "";
};

const SIMPLECODE = (event) => {
	let code = KEYCODE(event);
	if(code.length === 0) return "";

	mainKey: do{
		switch(code) {
			case 'BracketLeft': code = '['; break mainKey;
			case 'BracketRight': code = ']'; break mainKey;
			case 'Semicolon': code = ';'; break mainKey;
			case 'ControlLeft': code = 'Ctrl'; break mainKey;
			case 'ControlRight': code = 'CtrlRight'; break mainKey;
			case 'Escape': code = 'Esc'; break mainKey;
		}

		if(code.startsWith('Key')){
			code = code.slice(3);
			break mainKey;
		}

		if(code.startsWith('Digit') || code.startsWith('Arrow')){
			code = code.slice(5);
		}
		if(code.endsWith('Left') && code !== 'Left'){
			code = code.slice(0, -4);
		}
	}while(false);

	if(event.shiftKey && !code.startsWith('Shift')) code = `Shift+${code}`;
	if(event.altKey && !code.startsWith('Alt')) code = `Alt+${code}`;
	if(event.ctrlKey && !code.startsWith('Ctrl')) code = `Ctrl+${code}`;

	return code;
};

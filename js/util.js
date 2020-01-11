/// JS file containing misc util functions

if(!('includes' in String.prototype)){
	String.prototype.includes = function(token){
		return this.indexOf(token) >= 0;
	};
}

if(!('includes' in Array.prototype)){
	Array.prototype.includes = function(token){
		return this.indexOf(token) >= 0;
	};
}

/// Shorthand for Math.round()
const RD = Math.round;

/// Round to half-int
const RDH = (x) => RD(x+0.5)-0.5;

/// Clip to a range
const CLIP = (x, a, b) => x<a ? a : x>b ? b : !isFinite(x) ? a : x;

/// Align to the value
const ALIGN = (a, x) => x%a === 0 ? x : RD(x/a)*a;

/// Create a quad from 2D coordinates
const QUAD = (points, [ax, ay], [bx, by], [cx, cy], [dx, dy]) => points.push(
	ax, ay, 0, bx, by, 0, cx, cy, 0, ax, ay, 0, cx, cy, 0, dx, dy, 0
);

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

/// AA tree for managing non-overlapping intervals
class AATree {
	constructor(initData) {
		this.size = 0;
		this.root = null;
		if(initData) initData.forEach((data) => {
			this.add(data.y, data.l || 0, data.data);
		});
	}
	add(y, l, data) {
		const node = new AATreeNode(+y, +l, data);
		if(this.root) {
			const prev = this.root._insert(node);
			if(prev) {
				return [false, prev];
			} else {
				++this.size;
				return [true, node];
			}
		} else {
			this._setChild(node);
			++this.size;
			return [true, node];
		}
	}
	get(y) {
		return this.root ? this.root._get(y) : null;
	}
	intersects(y, l) {
		return this.root ? this.root._intersects(y, l) : false;
	}
	first() {
		return this.root ? this.root.first() : null;
	}
	last() {
		return this.root ? this.root.last() : null;
	}
	traverse(visitor) {
		if(this.root) this.root.traverse(visitor);
	}
	_setChild(node) {
		this.root = node;
		node._parent = this;
	}
	_removeChild(node) {
		this.root = null;
	}
	_adjustAfterRemove() {}
	_notifyRemove() {
		--this.size;
	}
}
class AATreeNode {
	constructor(y, l, data) {
		this.y = y;
		this.l = l;
		this.data = data;

		this._level = 1;
		this._left = null;
		this._right = null;
		this._parent = null;
	}
	remove() {
		this._notifyRemove();
		this._remove(null);
	}
	first() {
		return this._left ? this._left.first() : this;
	}
	last() {
		return this._right ? this._right.last() : this;
	}
	next() {
		return this._right ? this._right.first() : null;
	}
	prev() {
		return this._left ? this._left.last() : null;
	}
	traverse(visitor) {
		this._left && this._left.traverse(visitor);
		visitor(this);
		this._right && this._right.traverse(visitor);
	}
	_remove(from) {
		if(this._isLeaf()){
			const parent = this._parent;
			parent._removeChild(this);
			parent._adjustAfterRemove(from);
			return;
		}else if(!this._left){
			const l = this.next();
			l._remove(this);
			this._set(l);
		}else{
			const l = this.prev();
			l._remove(this);
			this._set(l);
		}
		this._adjustAfterRemove(from);
	}
	_adjustAfterRemove(stop) {
		if(this === stop) return;
		const parent = this._parent;
		this._decreaseLevel();
		let newTree = this._skew();
		if(newTree._right){
			newTree._right._skew();
		}
		if(newTree._right && newTree._right._right){
			newTree._right._right._skew();
		}
		newTree = newTree._split();
		if(newTree._right){
			newTree._right._split();
		}
		parent._adjustAfterRemove(stop);
	}
	_set(node) {
		this.y = node.y;
		this.l = node.l;
		this.data = node.data;
	}
	_notifyRemove() {
		this._parent._notifyRemove();
	}
	_isLeaf() {
		return !(this._left || this._right);
	}
	_get(y) {
		if(y < this.y) {
			return this._left ? this._left._get(y) : null;
		} else if(y > this.y+this.l) {
			return this._right ? this._right._get(y) : null;
		}
		return this;
	}
	_intersects(y, l) {
		if(y+l < this.y) {
			return this._left ? this._left._intersects(y, l) : false;
		}
		if(this.y+this.l < y) {
			return this._right ? this._right._intersects(y, l) : false;
		}
		return true;
	}
	_replaceChild(node, repl) {
		if(node.y < this.y) this._left = repl;
		else this._right = repl;

		if(repl) repl._parent = this;
	}
	_setChild(node) {
		this._replaceChild(node, node);
	}
	_removeChild(node) {
		this._replaceChild(node, null);
	}
	_insert(node) {
		if(node.y === this.y) {
			return this;
		} else if(node.y <= this.y) {
			if(node.y + node.l >= this.y) {
				return this;
			}
			if(this._left) {
				const result = this._left._insert(node);
				if(result) return result;
			} else {
				this._setChild(node);
			}
		} else if(node.y > this.y) {
			if(this.y + this.l >= node.y) {
				return this;
			}
			if(this._right) {
				const result = this._right._insert(node);
				if(result) return result;
			} else {
				this._setChild(node);
			}
		}
		this._skew()._split();
		return null;
	}
	_skew() {
		if(!this._left) return this;
		if(this._left._level !== this._level) return this;
		const left = this._left;
		const parent = this._parent;
		if(left._right) {
			this._setChild(left._right);
		} else {
			this._left = null;
		}
		left._setChild(this);
		parent._setChild(left);
		return left;
	}
	_split() {
		if(!this._right || !this._right._right) return this;
		if(this._level !== this._right._right._level) return this;
		const right = this._right;
		const parent = this._parent;
		if(right._left) {
			this._setChild(right._left);
		} else {
			this._right = null;
		}
		right._setChild(this);
		parent._setChild(right);
		++right._level;
		return right;
	}
	_decreaseLevel() {
		const levelOf = (node) => node ? node._level : 0;
		const shouldBe = Math.min(levelOf(this._left), levelOf(this._right))+1;
		if(shouldBe < this._level){
			this._level = shouldBe;
			if(shouldBe < levelOf(this._right)){
				this._right._level = shouldBe;
			}
		}
	}
}

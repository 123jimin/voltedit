/// AA tree for managing non-overlapping intervals
class AATree {
	constructor(initData) {
		this.size = 0;
		this.root = null;
		if(initData) initData.forEach((data) => {
			this.add(data.y, data.l || 0, data.data);
		});
	}
	/// Insert an interval [y, y+l]
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
	/// Get all nodes between [y, y+l)
	/// Note that the range is open to the right side!
	getAll(y, l) {
		const arr = [];
		if(this.root) this.root._getAll(arr, y, l);
		return arr;
	}
	getLE(y) {
		return this.root ? this.root._getLE(y) : null;
	}
	getGE(y) {
		return this.root ? this.root._getGE(y) : null;
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

		if(!isFinite(l) || l < 0) throw new Error("l must be non-negative for an AATreeNode!");
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
	prev() {
		if(this._left) return this._left.first();
		let node = this;
		while(!node._parent.root && node === node._parent._left) node = node._parent;
		if(node._parent.root) return null;
		return node._parent;
	}
	next() {
		if(this._right) return this._right.first();
		let node = this;
		while(!node._parent.root && node === node._parent._right) node = node._parent;
		if(node._parent.root) return null;
		return node._parent;
	}
	_prevUnderSelf() {
		return this._left ? this._left.last() : null;
	}
	_nextUnderSelf() {
		return this._right ? this._right.first() : null;
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
			const l = this._nextUnderSelf();
			l._remove(this);
			this._set(l);
		}else{
			const l = this._prevUnderSelf();
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
	_getLE(y) {
		if(y < this.y) {
			return this._left ? this._left._getLE(y) : null;
		} else if(y > this.y + this.l) {
			if(this._right) {
				const le = this._right._getLE(y);
				if(le) return le;
			}
		}
		return this;
	}
	_getGE(y) {
		if(y > this.y+this.l) {
			return this._right ? this._right._getGE(y) : null;
		} else if(y < this.y) {
			if(this._left) {
				const ge = this._left._getGE(y);
				if(ge) return ge;
			}
		}
		return this;
	}
	_getAll(arr, y, l) {
		if(l <= 0) return;
		if(y < this.y) {
			this._left && this._left._getAll(arr, y, l);
		}
		if(y+l > this.y && y <= this.y+this.l) {
			arr.push(this);
		}
		if(y+l-1 > this.y+this.l) {
			this._right && this._right._getAll(arr, y, l);
		}
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

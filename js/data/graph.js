 class VGraphPoint {
	/// Y is stored in the tree containing the point.
	constructor(v, vf, a, b) {
		this.v = v;
		this.vf = (vf == null) ? v : vf;
		this.a = a || 0;
		this.b = b || 0;
	}
	isSlam() {
		return this.vf !== this.v;
	}
	toKSON(graph, y) {
		const obj = {'v': this.v};
		obj[graph.isRelative ? 'ry': 'y'] = y;
		if(this.vf !== this.v) obj.vf = this.vf;
		if(this.a !== this.b){
			[obj.a, obj.b] = [this.a, this.b];
		}

		return obj;
	}
	toKSH(vf) {
		const v = vf ? this.vf : this.v;
		return KSH_LASER_VALUES[Math.round(CLIP(v, 0, 1)*(KSH_LASER_VALUES.length-1))];
	}
}

/// Graphs used by lasers, cameras, etc... of KSON
class VGraph {
	constructor(isRelative, options) {
		this.isRelative = isRelative;
		if(isRelative){
			/// 2 for wide lasers
			this.wide = options.wide || 1;
			/// Start tick for the graph
			this.iy = options.y || 0;
		}else{
			this.wide = 1;
			this.iy = 0;
		}

		this.points = new AATree();
	}
	getLength() {
		return this.points.size ? this.points.last().y : 0;
	}
	getMinResolution(begin, len, forKSH) {
		begin -= this.iy;

		let resolution = 0;
		const collapseTick = forKSH ? KSH_LASER_SLAM_TICK : 0;
		const points = this.points.getAll(begin-collapseTick, len+collapseTick);
		points.forEach((point) => {
			if(point.y >= begin) resolution = GCD(resolution, point.y);
			if(forKSH && point.data.isSlam()) {
				const slamY = point.y + collapseTick;
				if(slamY < begin+len) resolution = GCD(resolution, slamY);
			}
		});

		return resolution;
	}
	toKSON() {
		const obj = {'y': this.iy, 'v': []};
		this.points.traverse((node) => {
			obj.v.push(node.data.toKSON(this, node.y));
		});

		if(this.wide !== 1) obj.wide = this.wide;
		return obj;
	}
	/// Push points read from the KSH, in an increasing y order.
	pushKSH(y, v, collapse) {
		// For ksh charts, ticks are given in absolute values.
		y -= this.iy;
		if(this.points.size > 0){
			const lastPoint = this.points.last();
			if(y < lastPoint.y)
				throw new Error("Invalid insertion order in VGraph.pushKSH!");
			if(collapse && y <= lastPoint.y + KSH_LASER_SLAM_TICK){
				lastPoint.data.vf = v;
				return;
			}
		}

		const point = new VGraphPoint(v);
		this.points.add(y, 0, point);
	}
	/// Push points read from the KSON
	pushKSON(data) {
		const point = new VGraphPoint(data.v, data.vf, data.a, data.b);
		this.points.add(this.isRelative ? data.ry : data.y, 0, point);
	}
}

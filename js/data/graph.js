class VGraphPoint {
	constructor(params, edit) {
		/// Slam start point and end point
		this.v = params.v;
		this.vf = (params.vf == null) ? params.v : params.vf;

		/// Whether the current point is connected to the next point
		this.connected = !!params.connected;
		
		this.wide = params.wide || 1;
		this.a = params.a || 0;
		this.b = params.b || 0;

		if(edit) this.setEdit(edit);
	}
	setEdit(edit) {
		this.edit = edit;
		edit.point = this;
	}
	isSlam() {
		return this.vf !== this.v;
	}
	toKSH(vf) {
		const v = vf ? this.vf : this.v;
		return KSH_LASER_VALUES[Math.round(CLIP(v, 0, 1)*(KSH_LASER_VALUES.length-1))];
	}
	toKSON(isRelative, iy, y) {
		const point = {};
		point[isRelative ? 'ry' : 'y'] = y-iy;
		point.v = this.v;
		if(this.isSlam()) point.vf = this.vf;
		if(this.a) point.a = this.a;
		if(this.b) point.b = this.b;

		return point;
	}
}

/// This only manages reading/writing KSON/KSH graph segments.
/// The editor only stores VGraphPoints, which are easier to manipulate.
class VGraphSegment {
	constructor(isRelative, options) {
		this.isRelative = isRelative;
		if(isRelative){
			this.wide = +(options.wide || 1);
			this.iy = options.y || 0;
		}else{
			this.wide = 1;
			this.iy = 0;
		}

		this.points = new AATree();
	}
    /// Push points read from the KSH, in an increasing y order.
    pushKSH(y, v, collapse) {
 	   if(this.points.size > 0){
 		   const lastPoint = this.points.last();
 		   if(y < lastPoint.y)
 			   throw new Error("Invalid insertion order in VGraph.pushKSH!");
 		   if(collapse && y <= lastPoint.y + KSH_LASER_SLAM_TICK){
 			   lastPoint.data.vf = v;
 			   return;
 		   }
		   lastPoint.data.connected = true;
 	   }

 	   const point = new VGraphPoint({'v': v, 'connected': false, 'wide': this.wide});
 	   this.points.add(y, 0, point);
    }
    /// Push points read from the KSON
    pushKSON(data) {
		if(this.points.size > 0){
			this.points.last().data.connected = true;
		}
 		const point = new VGraphPoint({'v': data.v, 'vf': data.vf, 'connected': false, 'a': data.a, 'b': data.b});
 		this.points.add(this.iy + (this.isRelative ? data.ry : data.y), 0, point);
    }
}

VGraphSegment.fromPoints = function VGraphSegment$fromPoints(tree, isRelative){
	if(tree.size === 0) return [];

	const sections = [];
	const currSection = null;
	tree.traverse((node) => {
		if(!currSection){
			currSection = {
				'y': node.y, 'v': []
			};
			if(node.data.wide !== 1)
				currSection.wide = node.data.wide;
		}
		currSection.v.push(node.data.toKSON(isRelative, currSection.y, node.y));

		if(!node.data.connected){
			if(currSection.v.length > 1) sections.push(currSection);
			currSection = null;
		}
	});
	if(currSection && currSection.v.length > 1){
		sections.push(currSection);
	}
	return sections;
};

class VEditGraphSectionContext extends VEditContext {}

class VEditLaserContext extends VEditGraphSectionContext {
	constructor(editor, lane) {
		super(editor, `laser-${['left','right'][lane]}`);
		this.lane = lane;
	}
	getObjectAt(event) {
	}
	areSamePos(e1, e2) {
		return e1.tick === e2.tick &&
			ALIGN(this.editor.laserSnap, e1.v) === ALIGN(this.editor.laserSnap, e2.v);
	}
}

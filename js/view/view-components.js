/// Contains components of VView, which are  not directly involved in rendering the chart.

/// Manager for the scrollbar
class VViewScrollBar {
	constructor(view) {
		this.view = view;
		this.elem = view.elem.querySelector(".chart-scrollbar");
		this.tickPerPixel = 0;
		this.scrolling = false;
		this.initTickLoc = 0;
		this.initMouseY = 0;

		this.elem.addEventListener('mousedown', this.startScroll.bind(this));
		this.elem.addEventListener('touchstart', TOUCH(this.startScroll.bind(this)), {'passive': true});
	}
	startScroll(event) {
		this.scrolling = true;
		this.initMouseY = event.pageY;
		this.initTickLoc = this.view.tickLoc;
		this.elem.classList.add('drag');
	}
	stopScroll() {
		this.scrolling = false;
		this.elem.classList.remove('drag');
	}
	trigger(y) {
		const lastTick = this.view.lastTick;
		const dy = this.initMouseY - y;
		const dt = dy * this.tickPerPixel;
		let newTick = RD(this.initTickLoc + dt);
		newTick = CLIP(newTick, 0, lastTick);
		this.view.setLocation(newTick);
	}
	update() {
		const lastTick = this.view.lastTick;
		if(lastTick === 0) {
			this.elem.style.display = 'none';
			return;
		}

		const scale = this.view.scale;

		this.elem.style.display = 'block';
		this.elem.style.width = `${scale.scrollBarWidth}px`;

		// Scale the scroll bar so that...
		// 1. it is roughly proportional to how much the chart is visible
		// 2. it's between 0.05H and 0.9H
		const visibleTicks = this.view.p2t(this.view.height*scale.columns - scale.marginBottom) / lastTick;
		const scrollBarHeight = RD(this.view.height*CLIP(visibleTicks, 0.05, 0.9));
		const scrollBarTop = (this.view.height - scrollBarHeight) * (1 - this.view.tickLoc / lastTick);
		this.elem.style.top = `${scrollBarTop}px`;
		this.elem.style.height = `${scrollBarHeight}px`;

		this.tickPerPixel = lastTick/(this.view.height - scrollBarHeight);
	}
}

/// Manager for baselines
class VViewBaseLines {
	constructor(view) {
		this.view = view;
		this.svg = view.elem.querySelector('.chart-baselines');
		this.lines = [];
		this.copiesArr = [];
		this.currHeight = 100; // will be adjusted on resize
		this.bottomOffset = 0;

		const defs = this._createElem(this.svg, 'defs');
		const baseLinesDef = this._createElem(defs, 'g');
		baseLinesDef.id = 'baseLines';

		const masterBaseLine = this.master = this._createElem(baseLinesDef, 'line');
		masterBaseLine.id = 'masterBaseLine';
		masterBaseLine.setAttribute('x1', 0);
		masterBaseLine.setAttribute('y1', 0);
		masterBaseLine.setAttribute('x2', 0);
		masterBaseLine.setAttribute('y2', this.currHeight);
		masterBaseLine.setAttribute('stroke', view.color.baseLines);
		masterBaseLine.setAttribute('stroke-width', 1);

		for(let i=-2; i<=2; ++i) {
			if(i === 0) continue;
			const line = this._createElem(baseLinesDef, 'use');
			line.setAttribute('href', "#masterBaseLine");
			line.setAttribute('x', i*view.scale.noteWidth);
			this.lines.push([i, line]);
		}

		this.elem = this._createElem(this.svg, 'use');
		this.elem.setAttribute('href', "#baseLines");
		this.copies = this._createElem(this.svg, 'g');
		this.copies.id = 'baseLineCopies';
	}
	update() {
		if(this.currHeight != this.view.height){
			this.currHeight = this.view.height;
			this.master.setAttribute('y2', this.currHeight);
		}

		let bottomOffset = this.view.scale.marginBottom - this.view.t2p(this.view.tickLoc);
		if(bottomOffset < 0) bottomOffset = 0;
		if(this.bottomOffset != bottomOffset){
			this.bottomOffset = bottomOffset;
			this.elem.setAttribute('y', -bottomOffset);
		}
	}
	updateNoteWidth() {
		this.lines.forEach(([i, line]) => {
			line.setAttribute('x', i*this.view.scale.noteWidth);
		});
		this._updateCopies();
	}
	resize() {
		const scale = this.view.scale;
		this.svg.setAttribute('width', scale.fullWidth);
		this.svg.setAttribute('height', this.view.height);
		this.svg.setAttribute('viewBox', `${scale.viewBoxLeft} 0 ${scale.fullWidth} ${this.view.height}`);

		this._updateCopies();
	}
	_updateCopies() {
		if(this.copiesArr.length+1 != this.view.scale.columns){
			this.copiesArr.forEach((elem) => elem.remove());
			this.copiesArr = [];

			for(let i=1; i<this.view.scale.columns; ++i){
				const copy = this._createElem(this.copies, 'use');
				copy.setAttribute('href', "#baseLines");
				this.copiesArr.push(copy);
			}
		}

		for(let i=1; i<this.view.scale.columns; ++i){
			this.copiesArr[i-1].setAttribute('x', this.view.scale.columnOffset*i);
		}
	}
	_createElem(parent, tag) {
		const elem = document.createElementNS(this.svg.namespaceURI, tag);
		parent.appendChild(elem);
		return elem;
	}
}

const VVIEW_RENDER_PRIORITY = Object.freeze({
	'NONE': 0,
	'MINOR': 1,
	'RESIZE': 2,
	'REDRAW': 3
});

/// Manager for render queue
class VViewRenderQueue {
	constructor(view) {
		this.view = view;
		this.queue = [];
		this.currPriority = VVIEW_RENDER_PRIORITY.NONE;
	}
	push(func, priority) {
		if(priority < this.currPriority) return;

		const triggerAnimationFrame = (this.queue.length == 0);
		if(priority == this.currPriority && priority < VVIEW_RENDER_PRIORITY.RESIZE) {
			const lowPriority = priority === VVIEW_RENDER_PRIORITY.NONE;
			if(!lowPriority || this.queue.length === 0) {
				this.queue.push(func.bind(this.view));
			}
		}
		else {
			this.queue = [func.bind(this.view)];
			this.currPriority = priority;
		}

		if(triggerAnimationFrame) {
			window.requestAnimationFrame(this._onAnimationFrame.bind(this));
		}
	}
	_onAnimationFrame() {
		this.queue.forEach((f) => f());
		this.queue = [];

		this.view.render.render();
		this.currPriority = VVIEW_RENDER_PRIORITY.NONE;
	}
}

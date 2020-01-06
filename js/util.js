/// JS file containing misc util functions

/// Shorthand for Math.round()
const RD = Math.round;

/// Round to half-int
const RDH = (x) => RD(x+0.5)-0.5;

/// Clip to a range
const CLIP = (x, a, b) => x<a ? a : x>b ? b : !isFinite(x) ? a : x;

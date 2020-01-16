/// Just a thin wrapper
const logger = Object.freeze({
	'error': (err) => window.voltedit ? window.voltedit.error(err) : console.error(err, err && err.stack),
	'warn': (message) => window.voltedit ? window.voltedit.warn(message) : console.warn(message),
	'log': (message) => console.log(message)
});

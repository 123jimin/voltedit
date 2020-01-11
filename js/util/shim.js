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

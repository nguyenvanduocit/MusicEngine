function Song(name, url) {
	this.name = name;
	this.url = url;
	this.status = "pending";//playing//stoping
	this.score = Math.floor((Math.random() * 10) + 1);
};

Song.prototype.voteUp = function() {
	this.score++;
};

Song.prototype.voteDown = function() {
	this.score--;
};

Song.prototype.resetVote = function(){
	this.score = 0;
};

Song.prototype.isPlaying = function(){
	return this.status == 'playing';
};

Song.prototype.getName = function(){
	return this.name;
};

Song.prototype.getUrl = function(){
	return this.url;
};
module.exports = Song;
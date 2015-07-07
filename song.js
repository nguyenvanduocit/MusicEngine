function Song(name, url) {
	this.name = name;
	this.url = url;
	this.status = "pending";//playing//stoping
	this.score = 0;
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

Song.isPlaying = function(){
	return this.status == 'playing';
};

Song.isPlaying = function(){
	return this.status == 'playing';
};
module.exports = Song;
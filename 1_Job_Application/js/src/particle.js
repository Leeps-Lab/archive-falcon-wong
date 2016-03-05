var CANVAS_W = $("#canvas").width();
var CANVAS_H = $("#canvas").height();
var MAX_24_BIT_NUM = 16777215;
var FRAME_R = 50;
var MAX_VELOCITY = document.getElementById('max_v').value;
var MIN_VELOCITY = document.getElementById('min_v').value;
var MAX_RADIUS = document.getElementById('max_rad').value;
var FADE_RATE = document.getElementById('fade_rate').value;
var s = 0;
var STATES = {'INIT': s++,
			  'SIMULATE': s++};
			 
function Util () {
	this.warp_on = false;
	this.collision_on = true;
	this.state = STATES.INIT;
}

Util.prototype = {
	int_to_hex: function (integer) {
		var hex = integer.toString(16);
		while (hex.length < 6) hex = "0" + hex;
		return hex;
	},
	random_color: function () {
		return "#" + this.int_to_hex(Math.round(MAX_24_BIT_NUM * Math.random()));
	},
	update_and_draw_particles: function (array) {
		ctx.fillStyle = "#FFFFFF";
		ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
		for (var i = 0; i < array.length; i++) {
			array[i].update_position();
			ctx.beginPath();
			ctx.arc(array[i].x, array[i].y,
					array[i].radius, 0, 2*Math.PI);
			ctx.fillStyle = array[i].color;
			ctx.fill();
		}
	},
	toggle_warp: function () {
		if (this.warp_on == true) {
			this.warp_on = false;
			document.getElementById('warp').value = "Warp Walls";
		} else {
			this.warp_on = true;
			document.getElementById('warp').value = "Solid Walls";
		}
	},
	toggle_collision: function () {
		if (this.collision_on == true) {
			this.collision_on = false;
			document.getElementById('particle').value = "Solid Particles";
		} else {
			this.collision_on = true;
			document.getElementById('particle').value = "Ghost Particles";
		}
	},
	add_particle: function (event) {
		particle_array.push(new Particle(event.clientX - canvas.offsetLeft, event.clientY - canvas.offsetTop));
	},
	reset_sim: function () {
		this.state = STATES.INIT;
	},
	change_max_v: function () {
		MAX_VELOCITY = document.getElementById('max_v').value;
	},
	change_min_v: function () {
		MIN_VELOCITY = document.getElementById('min_v').value;
	},
	change_max_radius: function () {
		MAX_RADIUS = document.getElementById('max_rad').value;
	},
	change_fade: function () {
		FADE_RATE = document.getElementById('fade_rate').value;
	}
};


function Particle (x, y) {
	this.dir_x = ((Math.random() >= 0.5) ? -1 : 1);
	this.dir_y = ((Math.random() >= 0.5) ? -1 : 1);
	this.x = x;
	this.y = y;
	this.v_x =  this.dir_x * ((MAX_VELOCITY - 4) * Math.random() + MIN_VELOCITY);
	this.v_y = this.dir_y * ((MAX_VELOCITY - 4) * Math.random() + MIN_VELOCITY);
	this.radius = (MAX_RADIUS/2) + (MAX_RADIUS/2) * Math.random();
	this.color = util.random_color();
	this.trail = [];
}

Particle.prototype = {
	constructor: Particle,
	update_position: function() {
		if (util.collision_on) this.check_collision_with_other_particle();
		if (util.warp_on) this.check_warp();
		else this.check_bounce();
		this.leave_trail();
		this.x += this.v_x;
		this.y += this.v_y;
	},
	check_bounce: function() {
		// Collide with walls
		var x_next = this.x + this.v_x;
		var y_next = this.y + this.v_y;
		var ch_x = false, ch_y = false;
		if (x_next <= this.radius || x_next + this.radius >= CANVAS_W) ch_x = true;
		if (y_next <= this.radius || y_next + this.radius >= CANVAS_H) ch_y = true;
		if (ch_x == true || ch_y == true) {
			this.bounce(this, ch_x, ch_y);
			return;
		}
	},
	check_collision_with_other_particle: function () {
		for (var i = 0; i < particle_array.length; i++) {
			for (var j = 0; j < particle_array.length; j++) {
				if (i == j) continue;
				var x1 = (particle_array[i].x + particle_array[i].v_x), x2 = (particle_array[j].x + particle_array[j].v_x);
				var y1 = (particle_array[i].y + particle_array[i].v_y), y2 = (particle_array[j].y + particle_array[j].v_y);
				if (Math.sqrt(Math.pow(x2-x1, 2) + Math.pow(y2-y1, 2)) < particle_array[i].radius / 2 + particle_array[j].radius / 2) {
					if (particle_array[i].dir_x == particle_array[j].dir_x) {particle_array[i].dir_x *= -1; particle_array[j].dir_x *= -1;}
					if (particle_array[i].dir_y == particle_array[j].dir_y) {particle_array[i].dir_y *= -1; particle_array[j].dir_y *= -1;}
					this.bounce(particle_array[i], true, true);
					this.bounce(particle_array[j], true, true);
				}
			}
		}
	},
	bounce: function (object, ch_x, ch_y) {
		if (ch_x) {
			object.dir_x *= -1;
			object.v_x = object.random_speed(object.dir_x);
			object.color = util.random_color();
		}
		if (ch_y) {
			object.dir_y *= -1;
			object.v_y = object.random_speed(object.dir_y);
			object.color = util.random_color();
		}
	},
	check_warp: function () {
		// Warp around boundaries
		var x_next = this.x + this.v_x;
		var y_next = this.y + this.v_y;
		var ch_x = false, ch_y = false;
		if (x_next <= -this.radius) this.x += CANVAS_W;
		if (x_next >= CANVAS_W + this.radius) this.x -= CANVAS_W;
		if (y_next <= -this.radius) this.y += CANVAS_H;
		if (y_next >= CANVAS_H + this.radius) this.y -= CANVAS_H;
	},
	random_speed: function(dir) {
		return dir * ((MAX_VELOCITY - 4) * Math.random() + MIN_VELOCITY);
	},
	leave_trail: function() {
		var trail = new Trail(this.x, this.y, this.radius, this.color);
		this.trail.push(trail);
		for (var i = 0; i < this.trail.length; i++) {
			if (this.trail[i].radius <= 0) this.trail.shift();
			else this.trail[i].fade();
		}
	}
};

function Trail (x, y, radius, color) {
	this.size = radius;
	this.x = x;
	this.y = y;
	this.radius = radius;
	this.color = color;
}

Trail.prototype = {
	fade: function() {
		ctx.beginPath();
		ctx.arc(this.x, this.y, this.radius, 0, 2*Math.PI);
		ctx.fillStyle = this.color;
		ctx.globalAlpha = this.radius / this.size;
		this.radius -= FADE_RATE;
		ctx.fill();
		ctx.globalAlpha = 1;
	}
};

// Setup
var util = new Util();
var canvas = document.getElementById("canvas");
canvas.addEventListener("mousedown", util.add_particle, false);
var ctx = canvas.getContext("2d");

function loop() {
	if ( typeof loop != "undefined")
	clearInterval(loop);
	loop = setInterval(main, 30);
	util.state = STATES.INIT;
}
loop();

function main() {
	switch (util.state) {
		case STATES.INIT:
			particle_array = [];
			ctx.fillStyle = "#FFFFFF";
			ctx.fillRect(0,0,CANVAS_W, CANVAS_H);
			ctx.font="30px Verdana";
			ctx.lineWidth = 3;
			ctx.strokeStyle = "#555555";
			ctx.strokeText("Click to add particles . . .", CANVAS_W / 5, CANVAS_H / 2);
			ctx.fillText("Click to add particles . . .", CANVAS_W / 5, CANVAS_H / 2);
			util.state = STATES.SIMULATE;
			break;
		case STATES.SIMULATE:
			if (particle_array.length > 0)
				util.update_and_draw_particles(particle_array);
			break;
	}
}
